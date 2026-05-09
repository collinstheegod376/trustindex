import { TwitterApi } from 'twitter-api-v2';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Redis connection for BullMQ and Caching
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

// Queues for rate-limiting
const replyQueue = new Queue('twitter-replies', { connection });
const dmQueue = new Queue('twitter-dms', { connection });

let BOT_USERNAME = process.env.BOT_USERNAME || 'larpfinderonx';

async function healthCheck() {
  console.log("Running health checks...");
  try {
    // Check Supabase
    const { error: sbError } = await supabase.from('profiles').select('id').limit(1);
    if (sbError) throw new Error("Supabase connection failed");
    
    // Check Redis
    const ping = await connection.ping();
    if (ping !== "PONG") throw new Error("Redis connection failed");
    
    // Check Twitter
    const me = await rwClient.v2.me();
    BOT_USERNAME = me.data.username.toLowerCase();
    
    console.log("Health check passed. Bot Username:", BOT_USERNAME);
  } catch (err) {
    console.error("Health check failed! Crashing process to allow restart:", err);
    process.exit(1);
  }
}

async function getAdmins() {
  const cacheKey = `admins_list`;
  const cached = await connection.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const hardcoded = (process.env.ADMIN_USERNAMES || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  const { data } = await supabase.from('profiles').select('x_handle').eq('is_admin', true);
  const dbAdmins = (data || []).map(a => a.x_handle?.toLowerCase()).filter(Boolean);
  
  const admins = [...new Set([...hardcoded, ...dbAdmins])];
  await connection.set(cacheKey, JSON.stringify(admins), 'EX', 300); // 5 minutes cache
  return admins;
}

async function canSendDMToAdmin(adminHandle) {
  const key = `dm_last:${adminHandle}`;
  const last = await connection.get(key);
  if (last && Date.now() - parseInt(last) < 300000) return false;
  await connection.set(key, Date.now(), 'EX', 300);
  return true;
}

async function queueAdminDMs(message) {
  const admins = await getAdmins();
  for (const adminHandle of admins) {
    if (!(await canSendDMToAdmin(adminHandle))) {
      console.log(`Skipping DM to ${adminHandle} (rate limited)`);
      continue;
    }
    
    await dmQueue.add('send-dm', { handle: adminHandle, text: message }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
  }
}

// Worker to process Replies
const replyWorker = new Worker('twitter-replies', async job => {
  const { tweetId, text } = job.data;
  try {
    await rwClient.v2.reply(text, tweetId);
    console.log(`[Queue] Sent reply to tweet ${tweetId}`);
  } catch (err) {
    console.error(`[Queue] Failed to reply to ${tweetId}:`, err);
    throw err;
  }
}, { 
  connection,
  limiter: { max: 8, duration: 1800000 } // 8 replies per 30 minutes -> 48 per 3 hours
});

// Worker to process DMs
const dmWorker = new Worker('twitter-dms', async job => {
  const { handle, text } = job.data;
  try {
    const user = await rwClient.v2.userByUsername(handle);
    if (user.data) {
      await rwClient.v1.sendDm({ recipient_id: user.data.id, text: text });
      console.log(`[Queue] Sent DM to ${handle}`);
    }
  } catch (err) {
    console.error(`[Queue] Failed to DM ${handle}:`, err);
    throw err;
  }
}, { connection });

async function isProcessed(tweetId) {
  const { data } = await supabase.from('processed_tweets').select('tweet_id').eq('tweet_id', tweetId).maybeSingle();
  return !!data;
}

async function markProcessed(tweetId) {
  await supabase.from('processed_tweets').upsert({ tweet_id: tweetId }, { onConflict: 'tweet_id' });
}

async function getAccount(target) {
  const cacheKey = `account:${target}`;
  const cached = await connection.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { data: account } = await supabase.from('tracked_accounts').select('*').eq('x_handle', target).maybeSingle();
  if (account) {
    await connection.set(cacheKey, JSON.stringify(account), 'EX', 3600); // 1 hour TTL
  }
  return account;
}

async function invalidateAccountCache(target) {
  await connection.del(`account:${target}`);
}

async function parseIntent(tweetContext) {
  const prompt = `
You are @larpfinderonx, a bot that answers questions about X accounts.
Given the following tweet (including thread context: parent tweet and quoted tweet if any), extract:

1. target_username: the X handle (without @) that the user is asking about.
   Rules:
   - If a handle is explicitly mentioned (e.g., "@killua"), use that.
   - If the user says "he", "she", "they", "this guy", "the host", "OP", "the person" - STRICTLY PRIORITIZE looking at the author of the QUOTED TWEET first. If there is a quoted tweet, the target is the author of the quoted tweet.
   - Else look at the author of the parent tweet (if this is a reply).
   - Else look at the author of the tweet being replied to.
   - If still ambiguous, return null.

2. intent: one of ["legit", "score", "verified", "admin", "report", "unknown"]
   - "legit": any question about being real, scam, larp, fake, trustworthy, safe.
   - "score": explicit request for numerical score ("what's his score")
   - "verified": only asks if verified ("is he verified")
   - "admin": command starts with "!" (e.g., "!adduser")
   - "report": contains "report" followed by a username
   - "unknown": none of the above

3. If intent == "report", also extract report_reason (everything after the username).

Output JSON only: {"intent": "...", "target_username": "... or null", "report_reason": "... or null"}.

Tweet Context:
${tweetContext}
`;
  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini parsing error:", err);
    return { intent: "unknown", target_username: null };
  }
}

async function handleAdminCommand(tweet, text, authorHandle) {
  const admins = await getAdmins();
  if (!admins.includes(authorHandle.toLowerCase())) return;

  let match;
  if ((match = text.match(/!adduser\s+@?(\w+)\s+(\d+)/i))) {
    const target = match[1].toLowerCase();
    const score = parseInt(match[2]);
    await supabase.from('tracked_accounts').upsert({ x_handle: target, status: 'verified', trust_score: score }, { onConflict: 'x_handle' });
    await invalidateAccountCache(target);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: @${target} added with score ${score}.` });
  }
  else if ((match = text.match(/!updatescore\s+@?(\w+)\s+(\d+)/i))) {
    const target = match[1].toLowerCase();
    const score = parseInt(match[2]);
    const { data } = await supabase.from('tracked_accounts').update({ trust_score: score }).eq('x_handle', target).select();
    if (!data || data.length === 0) {
      await replyQueue.add('reply', { tweetId: tweet.id, text: `❌ @${target} not found. Use !adduser first.` });
    } else {
      await invalidateAccountCache(target);
      await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: @${target} score updated to ${score}.` });
    }
  }
  else if ((match = text.match(/!removeuser\s+@?(\w+)/i))) {
    const target = match[1].toLowerCase();
    await supabase.from('tracked_accounts').delete().eq('x_handle', target);
    await invalidateAccountCache(target);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: @${target} removed from tracking.` });
  }
  else if ((match = text.match(/!mark\s+(?:larp|scam)\s+@?(\w+)/i))) {
    const target = match[1].toLowerCase();
    await supabase.from('tracked_accounts').upsert({ x_handle: target, status: 'scam', trust_score: 0 }, { onConflict: 'x_handle' });
    await invalidateAccountCache(target);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: @${target} marked as larp.` });
  }
  else if ((match = text.match(/!(?:unscam|unlarp)\s+@?(\w+)/i))) {
    const target = match[1].toLowerCase();
    await supabase.from('tracked_accounts').update({ status: 'verified' }).eq('x_handle', target);
    await invalidateAccountCache(target);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: @${target} larp status removed.` });
  }
  else if (text.match(/!listreports/i)) {
    const { data: reports } = await supabase.from('reports').select('*, tracked_accounts(x_handle)').eq('status', 'pending').limit(5);
    if (!reports || reports.length === 0) {
      await replyQueue.add('reply', { tweetId: tweet.id, text: `No pending reports.` });
      return;
    }
    const reportText = reports.map(r => `ID: ${r.id} | Target: @${r.tracked_accounts?.x_handle} | Reason: ${r.reason.substring(0, 50)}`).join('\n');
    await queueAdminDMs(`Pending Reports:\n${reportText}`);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Sent last 5 pending reports to your DM.` });
  }
  else if ((match = text.match(/!resolvereport\s+([a-zA-Z0-9-]+)\s+confirm/i))) {
    const id = match[1];
    const { data: report } = await supabase.from('reports').select('*, tracked_accounts(x_handle)').eq('id', id).maybeSingle();
    if (report && report.tracked_accounts) {
      await supabase.from('tracked_accounts').update({ status: 'scam' }).eq('id', report.tracked_account_id);
      await invalidateAccountCache(report.tracked_accounts.x_handle);
      await supabase.from('reports').delete().eq('id', id);
      await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: Report confirmed. Target marked as larp.` });
    }
  }
  else if ((match = text.match(/!resolvereport\s+([a-zA-Z0-9-]+)\s+dismiss/i))) {
    const id = match[1];
    await supabase.from('reports').delete().eq('id', id);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Done: Report dismissed.` });
  }
  else if (text.match(/!help/i)) {
    const helpMsg = `Admin Commands:\n!adduser @user score\n!updatescore @user score\n!removeuser @user\n!mark larp @user\n!unscam @user\n!listreports\n!resolvereport <id> confirm\n!resolvereport <id> dismiss`;
    await queueAdminDMs(helpMsg);
    await replyQueue.add('reply', { tweetId: tweet.id, text: `✅ Sent commands to your DM.` });
  }
}

async function checkIsFollowing(authorId, authorHandle) {
  const cacheKey = `follows:${authorId}`;
  const cached = await connection.get(cacheKey);
  // Cache for 1 day if following, 5 mins if not following
  if (cached !== null) return cached === 'true';

  try {
    const friendship = await rwClient.v1.get('friendships/show.json', { source_id: authorId, target_screen_name: BOT_USERNAME });
    const isFollowing = friendship.relationship.source.following;
    await connection.set(cacheKey, isFollowing ? 'true' : 'false', 'EX', isFollowing ? 86400 : 300);
    return isFollowing;
  } catch (err) {
    console.error("Error checking following status:", err);
    return true; // Fail open
  }
}

async function generateFollowRequestReply(text, authorHandle) {
  const prompt = `
You are @${BOT_USERNAME}, a helpful bot that checks if X accounts are scams or legit.
@${authorHandle} just asked you a question: "${text}"

However, they are NOT following you. 
Write a short, polite, and friendly ONE-SENTENCE reply telling them that you'd love to help, but they need to follow you first. 
Be nice, maybe slightly playful. Do not use hashtags.

Examples:
- "Hey @${authorHandle}, I'd love to run that check for you, but I only serve my followers—hit that follow button and try again! 💙"
- "I've got the info you need, but you gotta follow me first! 😉"

Output ONLY the reply text, nothing else.
`;
  try {
    const result = await model.generateContent(prompt);
    let reply = result.response.text().trim();
    return reply.replace(/^["']|["']$/g, '');
  } catch (e) {
    return `Hey @${authorHandle}, I'd love to check that for you, but please follow me first! 💙`;
  }
}

async function generateReply(originalQuestion, targetUsername, account) {
  const prompt = `
You are @larpfinderonx, a bot that answers questions about X accounts.
The user asked: "${originalQuestion}"
The database shows:
- Username: @${targetUsername}
- Status: ${account ? account.status : 'not_found'}
- Score: ${account?.trust_score ?? 'none'} (only if status is 'verified')

Rules:
- Reply with ONE short sentence answering the user's question.
- NEVER include "/100" after the score.
- NEVER give advice (no "DYOR", "be careful", "report", etc.).
- If status is 'scam', reply with a clear warning (use the word 'larp' occasionally).
- If status is 'verified', state the score naturally.
- If not found, say so.
- Vary your wording every time - do NOT repeat the same sentence structure.
- Use casual, friendly tone but stay factual.

Examples of good replies:
- "Nah, @joker is a confirmed larp - stay far away."
- "Looks good! @satoshi has a trust score of 94."
- "I'd trust @vitalik - score 88 puts him in the safe zone."
- "Sorry, @newbie isn't in my database yet."
- "Watch out - @risky only has a score of 32."

Output ONLY the reply text, nothing else.
`;

  try {
    const result = await model.generateContent(prompt);
    let reply = result.response.text().trim();
    return reply.replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error("Gemini reply generation error:", err);
    if (account?.status === 'scam') return `🚨 LARP ALERT: @${targetUsername} is a confirmed larp.`;
    if (account?.status === 'verified') return `✅ SAFE: @${targetUsername} has a score of ${account.trust_score}.`;
    return `❓ @${targetUsername} is not in our database.`;
  }
}

async function processMention(tweet) {
  if (await isProcessed(tweet.id)) return;

  try {
    // Guard clause for missing author
    if (!tweet.author || !tweet.author.username) {
      console.error("Missing author in tweet:", tweet.id);
      return;
    }

    const authorHandle = tweet.author.username.toLowerCase();
    const authorId = tweet.author.id;
    
    // Prevent self-reply and bot loops
    if (authorHandle === BOT_USERNAME || authorHandle.endsWith('bot')) return;

    // Must be following the bot (Admin commands bypass this check)
    const isAdmin = (await getAdmins()).includes(authorHandle);
    if (!isAdmin) {
      const isFollowing = await checkIsFollowing(authorId, authorHandle);
      if (!isFollowing) {
        const replyText = await generateFollowRequestReply(tweet.text, authorHandle);
        await replyQueue.add('reply', { tweetId: tweet.id, text: replyText });
        await markProcessed(tweet.id);
        return;
      }
    }

    const text = tweet.text;

    // Build context with robust try-catch for referenced tweets
    let context = `Author: @${authorHandle}\nTweet: ${text}\n`;
    if (tweet.referenced_tweets) {
      for (const ref of tweet.referenced_tweets) {
        try {
          const refTweet = await rwClient.v2.singleTweet(ref.id, { expansions: 'author_id' });
          const refAuthor = refTweet.includes?.users?.find(u => u.id === refTweet.data?.author_id)?.username || 'unknown';
          context += `\n${ref.type} from @${refAuthor}:\n${refTweet.data?.text || ''}\n`;
        } catch (err) {
          console.error(`Failed to fetch referenced tweet ${ref.id}:`, err);
          context += `\n${ref.type} from unknown: [unavailable]\n`;
        }
      }
    }

    const parsed = await parseIntent(context);
    
    if (parsed.intent === 'admin' || text.includes('!')) {
      await handleAdminCommand(tweet, text, authorHandle);
      await markProcessed(tweet.id);
      return;
    }

    if (!parsed.target_username || parsed.intent === 'unknown') {
      const dmMsg = `🔍 Bot failed to understand a mention.\n\nTweet text: ${text}\nLink: https://twitter.com/${authorHandle}/status/${tweet.id}`;
      await queueAdminDMs(dmMsg);
      await markProcessed(tweet.id);
      return;
    }

    const target = parsed.target_username.toLowerCase().replace('@', '');

    if (parsed.intent === 'report') {
      let account = await getAccount(target);
      if (!account) {
        const res = await supabase.from('tracked_accounts').insert({ x_handle: target, status: 'pending', trust_score: 50 }).select('id').maybeSingle();
        account = res.data;
        await invalidateAccountCache(target);
      }
      
      const { data: profile } = await supabase.from('profiles').select('id').eq('x_handle', authorHandle).maybeSingle();
      
      await supabase.from('reports').insert({
        tracked_account_id: account.id,
        reporter_id: profile?.id || null,
        reason: parsed.report_reason || 'Reported via X Bot',
        status: 'pending'
      });
      await replyQueue.add('reply', { tweetId: tweet.id, text: `📝 Report recorded for @${target}. Thank you.` });
      await markProcessed(tweet.id);
      return;
    }

    // Check database
    const account = await getAccount(target);

    // Generate a dynamic reply using Gemini
    const generatedReply = await generateReply(text, target, account);
    await replyQueue.add('reply', { tweetId: tweet.id, text: generatedReply });

    await markProcessed(tweet.id);

  } catch (error) {
    console.error("Error processing mention:", error);
    const dmMsg = `🔍 Bot encountered an error.\n\nError: ${error.message}\nLink: https://twitter.com/${tweet?.author?.username || 'unknown'}/status/${tweet?.id}`;
    await queueAdminDMs(dmMsg);
  }
}

async function startPolling() {
  await healthCheck();
  let sinceId = undefined;

  setInterval(async () => {
    try {
      // Need to fetch me dynamically to get user ID if not stored globally
      const me = await rwClient.v2.me();
      
      const mentions = await rwClient.v2.userMentions(me.data.id, {
        since_id: sinceId,
        expansions: ['author_id', 'referenced_tweets.id'],
        'tweet.fields': ['created_at', 'text', 'referenced_tweets'],
      });

      for (const tweet of mentions) {
        sinceId = tweet.id;
        const author = mentions.includes?.users?.find(u => u.id === tweet.author_id);
        tweet.author = author;
        await processMention(tweet);
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 60000); // 60 seconds
}

startPolling();
