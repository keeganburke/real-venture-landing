-- 007_content_ingest.sql
-- Populate real curriculum: update lesson titles + insert real content
-- (video + intro text + easy quiz) for all 13 lessons.
-- Idempotent: safe to re-run. Uses course_slug + sort_order to key updates.
-- Note: overwrites any existing content JSONB on these lessons.

-- =============================================================================
-- FOUNDATIONS
-- =============================================================================

UPDATE lessons SET
  title = 'Orientation & Expectations',
  slug = 'orientation-and-expectations',
  content = '[
    {"type":"video","youtube_id":"m6FAvTl5Woo"},
    {"type":"text","body":"Welcome to Real Venture. This program walks you through the entire wholesaling process from finding your first deal to scaling into a real business. There are multiple paths you can take, and none of them is universally best. There is a best path for you based on your capital, your risk tolerance, and how fast you want to move.\n\nThe way to win here is simple. Take consistent action, ask questions when you get stuck, and do not rush the process. Every student who has closed a deal did the same thing. They kept going. The first 30 days are about understanding the process and starting real conversations. By 60 days you have leads coming in. Around 90 days your first deal closes and you get paid. Some move faster. Some take longer. What matters is that you stay in the game.\n\nDo not fall into analysis paralysis. Watch the modules in order, take notes, and then take unprepared action. Step two reveals itself once you take step one. If you get stuck, that is what the Discord and Loom reviews are for. This is a business, not a lottery ticket, but when it clicks it clicks fast."},
    {"type":"quiz","id":"q1","question":"What is the most important behavior for succeeding in this program?","options":["Waiting until you understand every detail before taking action","Taking consistent action and asking questions when stuck","Skipping ahead to the modules about getting paid","Watching every module twice before doing anything"],"correct":1,"explanation":"Consistent action is the pattern behind every student win. Perfect understanding is not required to start."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'foundations') AND sort_order = 1;

UPDATE lessons SET
  title = 'What Wholesaling Actually Is',
  slug = 'what-wholesaling-actually-is',
  content = '[
    {"type":"video","youtube_id":"RT_ATaMI88k"},
    {"type":"text","body":"At its core, wholesaling is controlling a deal, not buying a house. You find a seller who wants speed or certainty, you put the property under contract at a price that makes sense for an investor, and then you sell that contract to a cash buyer for more than you have it under contract for. You never own the house. You are the deal sourcer, and you get paid for presenting an opportunity to someone who can actually close on it.\n\nThe money comes from spreads. Investors will pay for deals they cannot easily source themselves, and your fee lives inside the gap between what a seller will accept and what a buyer will pay. If there is no real spread, there is no deal. Wholesalers do not force profits. They discover them.\n\nMost people fail before deal one because they chase tactics instead of understanding deals. They look for the perfect script, avoid talking to real sellers, and quit right before momentum shows up. The truth is you do not need to be a great salesperson. If you can have a normal conversation with a human and actually want to solve a problem, you can make money doing this."},
    {"type":"quiz","id":"q1","question":"When you wholesale a property, what are you actually selling?","options":["The house itself","Your right to buy the property under the contract","A share of ownership in the property","A loan against the property"],"correct":1,"explanation":"You are selling the contract, not the house. You never take ownership. The buyer takes your place in the purchase agreement and closes on the property."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'foundations') AND sort_order = 2;

UPDATE lessons SET
  title = 'Traditional vs Secured Wholesaling',
  slug = 'traditional-vs-secured-wholesaling',
  content = '[
    {"type":"video","youtube_id":"-RVMXpyyiwM"},
    {"type":"text","body":"There are two very different ways to wholesale, and they carry very different risk profiles. Traditional wholesaling is what most people learn first. You find a seller, put the property under contract, and then hunt for a buyer during the inspection period. The risk is that if the buyer hesitates, the deal dies and you are stuck.\n\nSecured wholesaling flips the order. You find the buyer first, learn their exact buy box, and then source deals that already fit their demand. You lock the contract knowing the exit is already lined up. Dispo risk gets removed upstream. The inspection becomes a formality instead of a scramble.\n\nBoth approaches work, but they are not equal for beginners. Traditional shines when you already have capital, an established buyers list, and can absorb a deal falling through. Secured shines when you are starting out and cannot afford to have your first four contracts blow up. Every student result on the secured side comes from the same pattern: buyer first, then deal."},
    {"type":"quiz","id":"q1","question":"What is the key difference in secured wholesaling?","options":["You buy the property yourself before reselling it","You find the buyer first, then source deals that fit their buy box","You only work with off-market deals","You never sign a contract until after inspection"],"correct":1,"explanation":"Secured wholesaling means locking in a buyer and their buy box before you go find the deal. That removes the risk of getting stuck with a contract you cannot assign."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'foundations') AND sort_order = 3;

-- =============================================================================
-- FINDING DEALS & BUYERS
-- =============================================================================

UPDATE lessons SET
  title = 'How to Find a Buyer',
  slug = 'how-to-find-a-buyer',
  content = '[
    {"type":"video","youtube_id":"I1vSZZoXsqQ"},
    {"type":"text","body":"Finding a buyer is not about luck. It is about picking the right channel for where you are right now. Every channel trades something different. Time, money, control, or predictability. There is always something you give up.\n\nThere are four main levels. Facebook groups and DMs are free but slow and require hustle. Discord investor communities are where relationships actually get built, and this is where William found his biggest VIP buyer. JVing with other wholesalers is the fastest path to your first deal because you plug into someone who already has buyers. PropStream and public records give you the highest-intent buyers because they have already closed deals with cash, but it requires cold calling.\n\nContribute before you extract. These buyers do not care about you until you are useful to them. Provide value first, make friends, and the deals will follow. And no matter which channel you use, track everything in a simple spreadsheet: buyer name, buy box, contact info, where they buy. That list becomes your leverage."},
    {"type":"quiz","id":"q1","question":"What is the most important thing to do when reaching out to buyers in Discord communities?","options":["Ask for their buy box immediately","Contribute value before asking for anything","Post about your deals in every channel","Pay for a premium membership"],"correct":1,"explanation":"These buyers already work with wholesalers. They only pay attention once you are useful to them. Contribute first, ask later."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'finding-deals-and-buyers') AND sort_order = 1;

UPDATE lessons SET
  title = 'On-market Strategy',
  slug = 'on-market-strategy',
  content = '[
    {"type":"video","youtube_id":"PT2ehPhSdlM"},
    {"type":"text","body":"On-market wholesaling means finding deals on Zillow or the MLS and negotiating terms with the listing agent. Most wholesalers ignore it because they assume listed prices leave no room for a discount. That is wrong. Discounts absolutely exist when a listing has been sitting for 60 or 90 days, has price cuts, or the property is in a condition that most retail buyers cannot get financed on.\n\nThe edge is speed, clean data, and clear comps. Every piece of information you need is already on the listing: address, square footage, bed and bath count, photos, and sold comps in the area. That makes underwriting fast. Your job is to know your buyer buy box first, then use Zillow filters (days on market, price cuts, home type, keywords like as-is or cash only) to shortlist properties that could actually work.\n\nWhen you talk to the listing agent, keep it simple. Position yourself as serious, unrepresented, with proof of funds. Ask about condition, close date, existing offers, and whether the seller will accept as-is terms. If the numbers do not work after light underwriting, kill the deal fast. Almost-works deals steal your time. Your minimum spread rules exist for a reason."},
    {"type":"quiz","id":"q1","question":"What is the biggest signal that an on-market listing might accept a discount?","options":["The listing has high-quality professional photos","The property has been on the market for a long time with price cuts","The listing is in a good neighborhood","The listing agent is easy to reach"],"correct":1,"explanation":"Long days on market plus price cuts means the seller is tired and the price is drifting. That is where discounts open up."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'finding-deals-and-buyers') AND sort_order = 2;

UPDATE lessons SET
  title = 'Off-market Strategy',
  slug = 'off-market-strategy',
  content = '[
    {"type":"video","youtube_id":"ZZBdY5SBjwU"},
    {"type":"text","body":"Off-market wholesaling exists because not every seller wants the open market. Some want speed, privacy, or are dealing with a situation that makes listing painful. Off-market does not automatically produce better deals. It creates different access, and that access costs time, money, or management.\n\nThere are four main tiers. SMS text blasting is the cheapest way in, roughly 500 to 2500 dollars per month, and it works but requires strong filtering because most leads will not convert. Virtual assistants let you scale outreach without doing the calls yourself, typically 1500 to 3500 dollars per month, and the results depend on your systems more than the VAs. Facebook ads bring inbound leads at 3000 to 6000 dollars per month with better predictability, but they punish sloppy operators. Google ads are the highest-intent leads at 6000 to 10000 dollars per month, and they are best once your buyers and numbers are already dialed in.\n\nDo not start with off-market. It exposes weaknesses fast. Without buyer clarity, every lead looks good. Without confidence in your numbers, every call feels stressful. Off-market rewards operators who filter decisively, not beginners looking for a shortcut. Layer it in once you have proof of concept from on-market or JV deals first."},
    {"type":"quiz","id":"q1","question":"Which off-market channel is the cheapest way to start?","options":["Google ads","Facebook ads","SMS text blasting","Hiring a full team of VAs"],"correct":2,"explanation":"SMS is the lowest-cost entry point at roughly 500 to 2500 dollars per month, but it requires strong filtering because most leads will not convert."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'finding-deals-and-buyers') AND sort_order = 3;

UPDATE lessons SET
  title = 'Deal Analysis & Underwriting',
  slug = 'deal-analysis-and-underwriting',
  content = '[
    {"type":"video","youtube_id":"QWiUA_8Prco"},
    {"type":"text","body":"This is the most important module in the entire curriculum. If you do not understand the numbers, you will waste weeks on deals that were never going to close. The goal here is to be able to look at any property and quickly decide: is this a real deal, or is it a distraction?\n\nStart with fact-finding. You need the condition, the confirmed square footage, the age of the roof and HVAC, and photos or video of the inside. Then you pull sold comps on Zillow within the past six months, same square footage range (plus or minus 250 sq ft), same property type, in the same pocket. Do not cherry-pick comps to make the deal work. Pick honest anchors: one low comp, one high comp, and two to four in between. That gives you a real ARV range.\n\nOnce you have ARV and repair estimates, run the MAO formula: Max Allowable Offer equals ARV times 0.70 minus Repairs minus Your Fee. Seventy percent is the standard discount anchor for flippers in most markets. If the math only works when you round everything in your favor, it is not a deal. Kill it and move on."},
    {"type":"quiz","id":"q1","question":"What does ARV stand for?","options":["Average Rental Value","After Repair Value","Assigned Real Value","Approved Realtor Value"],"correct":1,"explanation":"ARV is the After Repair Value: what the property is worth after being fully repaired to market condition. It is the foundation of every underwriting calculation."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'finding-deals-and-buyers') AND sort_order = 4;

-- =============================================================================
-- CLOSING THE DEAL
-- =============================================================================

UPDATE lessons SET
  title = 'Acquisitions & Getting the Contract',
  slug = 'acquisitions-and-getting-the-contract',
  content = '[
    {"type":"video","youtube_id":"zuiIhmvRZcM"},
    {"type":"text","body":"This is where the deal actually happens. The first call with a seller is about learning whether the situation makes sense to keep working. Set expectations early, respect their time, and be human. You are not reading a script. You are having a conversation.\n\nOpen with context (where the lead came from), ask what they are looking to get for the property, then dig into the situation: who occupies the property, the condition, timeline, and motivation. If the price they want is dramatically higher than your max allowable offer, be honest that the number probably will not work, but ask if it is worth walking through the details anyway. If you are talking to a real estate agent on an on-market deal, skip the motivation questions. It just makes you sound green.\n\nDo not make your offer on the first call. Get all the info, do your real underwriting, then schedule a follow-up call to deliver the number. When you deliver, set expectations first, explain the logic, and keep the relationship intact no matter where the number lands. If they say no, put them in your follow-up sequence. The money is made in the follow-up. Deals come back weeks or months later all the time."},
    {"type":"quiz","id":"q1","question":"When should you deliver your actual offer to the seller?","options":["Immediately on the first call to lock them in","On a scheduled follow-up call after you have done real underwriting","Only after they sign a contract","By text message right after the first call"],"correct":1,"explanation":"Use the first call to gather information, then do real underwriting and deliver your number on a scheduled follow-up. Never guess a number live on the first call."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'closing-the-deal') AND sort_order = 1;

UPDATE lessons SET
  title = 'How to Fill Out & Sign the Contract',
  slug = 'how-to-fill-out-and-sign-the-contract',
  content = '[
    {"type":"video","youtube_id":"0zYgXGedPyg"},
    {"type":"text","body":"Once you have a verbal agreement, the next step is turning it into a signed, enforceable contract. There are two paths depending on how you found the deal. For off-market deals, you write up the contract yourself using a Purchase and Sale Agreement (PSA) template and send it through DocuSign. For on-market deals, the listing agent writes the contract on state forms and sends it to you to sign.\n\nOn off-market, keep it simple. Download the PSA template, fill in the buyer and seller info, the property address, purchase price, earnest money deposit, and closing date. Send it through DocuSign with the signature boxes pre-placed so the seller only has to click sign. Do not make them fill anything out. Reduce friction to zero.\n\nOn on-market, the agent will send you their state PSA. Always review the sellers disclosure carefully, confirm the earnest money amount and inspection period, and make sure the terms match what you agreed to on the call. It is the signature that makes the contract enforceable, not the form. If you are unsure about anything, ask before you sign. An LLC is recommended once you are doing regular deals, but you can close your first deal or two without one."},
    {"type":"quiz","id":"q1","question":"What makes a purchase contract legally enforceable?","options":["Being on official state forms","Having a notary present","The signatures of the parties","Being reviewed by a lawyer"],"correct":2,"explanation":"The signatures are what make the contract enforceable, not the form itself. A DocuSigned PSA on a template is just as binding as a state form when both parties sign."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'closing-the-deal') AND sort_order = 2;

UPDATE lessons SET
  title = 'Dispositions & Selling the Contract',
  slug = 'dispositions-and-selling-the-contract',
  content = '[
    {"type":"video","youtube_id":"gnf5lnrqdI4"},
    {"type":"text","body":"Dispositions is deal packaging. Your job is to make a buyer say send it without a 20 minute pitch. Good packaging means clean photos, clear numbers, honest condition notes, real comps, and terms upfront. Bad packaging is vague marketing copy with no comps, no rehab estimate, and no evidence.\n\nDecide up front whether you are blasting or auctioning. Blasting is for average deals with average demand and you want speed. Auctioning is for the bangers where you already know multiple buyers will want it. Then release in tiers: your A-list buyers first (the ones you have closed with before), then direct outreach to a cash buyer list, then JV partners, then Facebook groups last. Facebook is the noisiest channel with the lowest signal.\n\nGate everything. Before you send the address, require proof of funds, close-by date, and confirmation the buyer can wire EMD. That single filter kills 80 percent of the tire kickers. Once a buyer is locked (assignment signed, EMD deposited to title, walkthrough scheduled), keep a backup buyer warm in case the first one flakes. Most deals die not from bad numbers but from sloppy paperwork and nobody driving the timeline."},
    {"type":"quiz","id":"q1","question":"What should you require before sending property details to a new buyer?","options":["A friendly introduction message","Proof of funds and close-by date","A signed non-disclosure agreement","Their social media profile"],"correct":1,"explanation":"Gating on proof of funds and timeline filters out tire kickers immediately. Never share addresses or full details until a buyer proves they can actually close."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'closing-the-deal') AND sort_order = 3;

UPDATE lessons SET
  title = 'Title Work & Getting Paid',
  slug = 'title-work-and-getting-paid',
  content = '[
    {"type":"video","youtube_id":"bjTVjrzmdqw"},
    {"type":"text","body":"Once you have a signed PSA and a signed assignment agreement, the next step is opening the file with a title company. Title verifies ownership, runs a title search for liens or back taxes, prepares closing documents, coordinates funds, and gets everyone paid.\n\nUse a title company that is assignment friendly. Either use one we recommend, or find a local one and ask three questions on the first call: Are you familiar with assignment contracts? Do you handle double closes? Do you allow pass-through funding on double closes? If they sound confused or unsure, walk away. Not every title company understands investor deals, and a confused title company will kill your closing timeline.\n\nThere are two ways you get paid. On an assignment, your fee shows up on the settlement statement and title wires it to you at closing. On a double close, you have two separate contracts (A-to-B and B-to-C), and your fee is the spread between them. It is not disclosed on either settlement statement. Ninety percent of your deals will be assignments. In both cases, title pays you, not the buyer. Once closing docs are signed and funds wire in, you typically get paid same day or the next business day."},
    {"type":"quiz","id":"q1","question":"On a wholesale deal, who actually sends you your assignment fee?","options":["The end buyer directly","The seller","The title company","Your real estate agent"],"correct":2,"explanation":"The title company handles all the money at closing. They pay you your assignment fee directly from the closing funds, not the buyer or seller."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'closing-the-deal') AND sort_order = 4;

-- =============================================================================
-- SCALING
-- =============================================================================

UPDATE lessons SET
  title = 'Reinvesting & Scaling',
  slug = 'reinvesting-and-scaling',
  content = '[
    {"type":"video","youtube_id":"7dfPQjGJ0es"},
    {"type":"text","body":"Your first check is fuel, not a finish line. The most common mistake beginners make is closing their first deal, celebrating, spending most of the check on lifestyle, and then wondering why the next month is empty. One deal becomes a paycheck back to zero if you stop feeding the top of the funnel.\n\nThe rule is simple. Before you pay yourself heavy, fund your next month of lead generation. Sixty to eighty percent of your first check should go back into leads: more SMS, more list pulls, more marketing spend. Ten to twenty-five percent should go into basic systems that stop chaos: a simple CRM like GoHighLevel, a dialer, or a VA for ten to twenty hours a week. Five to fifteen percent can be a small win reward if you want one, but only after everything else is funded.\n\nUpgrade your marketing when you can prove you close deals from your current source, when you can afford sixty days of spend without panicking, and when the results are consistent instead of spiky. Start with basic outreach and SMS. Add a VA once volume gets chaotic. Layer in Facebook or Google ads once your process is solid and your dispo is fast. Cheaper lead generation is less predictable. Better lead generation is more predictable. Not more expensive. Better."},
    {"type":"quiz","id":"q1","question":"What should the majority of your first check go toward?","options":["A win reward for yourself","More lead generation for the next month","Paying off personal debt","Software subscriptions"],"correct":1,"explanation":"Sixty to eighty percent should go back into leads. That is the only way to stop your first deal from being a paycheck back to zero."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'scaling') AND sort_order = 1;

UPDATE lessons SET
  title = 'Case Studies',
  slug = 'case-studies',
  content = '[
    {"type":"video","youtube_id":"UsGpg5tI4ZE"},
    {"type":"text","body":"Three real deals from real students, all closed in their first three months. These are the pattern.\n\nDylan found a deal in St. Louis through an agent connection. Locked up at 78K, comps put it at 150K. Got paid 5K on assignment. Two more deals under contract with the same buyer at the time of recording. Roughly 10K in his first 60 days.\n\nMelissa found a property in Scott City, Missouri sitting on Zillow. Had the seller unlist and sell directly. Locked up at 39K after negotiating down from 50K. Comps around 100K. Got paid 4K on assignment. Another deal almost under contract now.\n\nEve found a deal in Granite City, Illinois on Zillow. Made an offer to the listing agent on state forms. Locked up at 60K, comps at 115K. The roof came back bad in inspection so the seller installed a new roof before closing. Got paid 5K, then another 3K on his second deal. Eight thousand cushion in his first three months while working a 60-hour week at his day job. Now scaling with VAs.\n\nWhat is repeatable here is not any specific tactic. It is the pattern. Take action, source deals that match a real buyer, use the profits to buy more opportunities, stack the reps. That is the entire game."},
    {"type":"quiz","id":"q1","question":"What is the common pattern across all three case studies?","options":["They all used the same lead source","They all closed their first deals within three months by taking consistent action","They all had prior real estate experience","They all had large starting budgets"],"correct":1,"explanation":"Different sources, different states, different buyer relationships. What they share is taking consistent action and closing within their first three months."}
  ]'::jsonb,
  updated_at = now()
WHERE course_id = (SELECT id FROM courses WHERE slug = 'scaling') AND sort_order = 2;
