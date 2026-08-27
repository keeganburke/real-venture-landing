-- Learn system: seed lessons. Requires learn/002_lessons.sql and
-- learn/004_seed_courses.sql (courses are looked up by slug).
-- All youtube_id values are "PLACEHOLDER" until real videos are wired in.
-- Idempotent: re-running skips (course_id, slug) pairs that already exist.

INSERT INTO lessons (course_id, slug, title, description, content, sort_order, requires_pro, is_published) VALUES

-- wholesaling-101 (beginner)
(
  (SELECT id FROM courses WHERE slug = 'wholesaling-101'),
  'what-is-wholesaling', 'What is Wholesaling?',
  'The model in plain English: contracts, assignments, and where your fee comes from.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Wholesaling is getting a property under contract at a discount, then assigning that contract to a cash buyer for a fee. You never buy the house. Your job is finding the deal and connecting it to demand."}]'::jsonb,
  1, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'wholesaling-101'),
  'the-14-day-sprint', 'The 14-Day Sprint',
  'The exact day-by-day path from zero to your first signed contract.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Here is how the 14-day sprint works: days 1-4 you learn the fundamentals, days 5-9 you analyze deals and build your buyer list, days 10-14 you send offers and lock up your first deal."},{"type":"quiz","question":"How many days does the sprint last?","options":["7","14","21","30"],"correct":1,"explanation":"14 days is the target."}]'::jsonb,
  2, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'wholesaling-101'),
  'your-first-offer', 'Your First Offer',
  'Send an offer this week, not someday. What good looks like.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"An offer is not a commitment to buy. It is the start of a negotiation. Send your first 10 offers using the max offer formula and let the numbers do the talking."},{"type":"action","label":"Try the Deal Analyzer","href":"https://realventurestudio.com"}]'::jsonb,
  3, false, true
),

-- buyers-first (beginner)
(
  (SELECT id FROM courses WHERE slug = 'buyers-first'),
  'why-buyers-come-first', 'Why Buyers Come First',
  'Start with demand and every later step gets easier.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Most people hunt houses first and pray a buyer shows up. Flip it: know your buyer, learn their buy box, and only chase deals you already know will sell."}]'::jsonb,
  1, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'buyers-first'),
  'finding-cash-buyers', 'Finding Cash Buyers',
  'Where real cash buyers hang out and how to reach them.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Cash buyers leave footprints: recent cash purchases, LLC-owned flips, landlord portfolios. Use the buyer directory and your market data to build a short list of active buyers."},{"type":"quiz","question":"What should you learn from a buyer before hunting deals?","options":["Their favorite color","Their buy box","Their mortgage rate","Nothing"],"correct":1,"explanation":"The buy box (areas, price range, condition, strategy) tells you exactly what to hunt."}]'::jsonb,
  2, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'buyers-first'),
  'the-buy-box', 'Nailing the Buy Box',
  'Turn a buyer conversation into a precise hunting checklist.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"A buy box is the buyer''s exact criteria: zip codes, price ceiling, beds and baths, condition tolerance, and target returns. Write it down and match every deal against it before you spend a minute on it."}]'::jsonb,
  3, false, true
),

-- deal-analysis-mastery (intermediate)
(
  (SELECT id FROM courses WHERE slug = 'deal-analysis-mastery'),
  'pulling-comps', 'Pulling Comps Like a Pro',
  'Find the sold properties that actually predict your deal''s value.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Good comps are recent, nearby, and similar: sold in the last 6 months, within half a mile, same beds baths and square footage range. Ignore listings; only solds count."}]'::jsonb,
  1, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'deal-analysis-mastery'),
  'calculating-arv', 'Calculating ARV',
  'After Repair Value is the number everything else hangs on.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"ARV is what the property sells for after a full renovation. Average your best comps, adjust for differences, and be conservative. An inflated ARV kills deals at the closing table."},{"type":"quiz","question":"What does ARV stand for?","options":["After Repair Value","Actual Rental Value","Average Rental Volume","Assessed Real Value"],"correct":0,"explanation":"ARV = After Repair Value, the post-renovation resale value."}]'::jsonb,
  2, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'deal-analysis-mastery'),
  'max-offer-formula', 'The Max Offer Formula',
  'ARV, repairs, buyer profit, your fee: the math that sets your ceiling.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Max offer = ARV x 70% minus repairs minus your assignment fee. Run every deal through the analyzer and never offer above the number."},{"type":"action","label":"Run a deal through the analyzer","href":"https://realventurestudio.com"}]'::jsonb,
  3, false, true
),

-- seller-scripts (intermediate)
(
  (SELECT id FROM courses WHERE slug = 'seller-scripts'),
  'first-call-framework', 'The First Call Framework',
  'The opening 90 seconds that decide the whole call.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Lead with curiosity, not a pitch. Ask about the property, the timeline, and the why. Sellers sell to people who listen."}]'::jsonb,
  1, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'seller-scripts'),
  'handling-objections', 'Handling Objections',
  'Price pushback, cold feet, and the agent threat: what to say.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Objections are requests for more information. Acknowledge, ask a question back, and re-anchor on their timeline and certainty. Never argue the price before you have rebuilt the value of speed and convenience."}]'::jsonb,
  2, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'seller-scripts'),
  'locking-the-price', 'Locking the Price',
  'Getting to a signed number without scaring the seller off.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Present the offer as a range first, then land on the number tied to their timeline. Confirm verbally, then send the contract the same day while the yes is warm."},{"type":"quiz","question":"When should you send the contract after a verbal yes?","options":["Next week","Within a month","The same day","After the buyer is found"],"correct":2,"explanation":"Same day. Momentum closes deals."}]'::jsonb,
  3, false, true
),

-- creative-finance (advanced, pro tier)
(
  (SELECT id FROM courses WHERE slug = 'creative-finance'),
  'seller-financing-basics', 'Seller Financing Basics',
  'When the seller becomes the bank, and why they would want to.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Seller financing means the seller carries the loan and you pay them over time. It unlocks deals where the numbers do not work for a cash offer, especially free-and-clear properties with patient sellers."}]'::jsonb,
  1, true, true
),
(
  (SELECT id FROM courses WHERE slug = 'creative-finance'),
  'subject-to-explained', 'Subject-To Explained',
  'Taking over payments on the existing mortgage, done right.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Subject-to means buying the property subject to the existing financing: the loan stays in the seller''s name and you take over payments. Powerful, and full of compliance details you must get right."}]'::jsonb,
  2, true, true
),
(
  (SELECT id FROM courses WHERE slug = 'creative-finance'),
  'stacking-strategies', 'Stacking Strategies',
  'Combining wholesale, sub-to, and seller finance on real deals.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"Advanced operators quote sellers more than one structure: a lower cash number and a higher creative number. Two offers doubles your close rate on the same lead flow."}]'::jsonb,
  3, true, true
),

-- llc-and-bank-setup (bonus)
(
  (SELECT id FROM courses WHERE slug = 'llc-and-bank-setup'),
  'forming-your-llc', 'Forming Your LLC',
  'The 30-minute setup that makes you a real business.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"File the LLC in your home state, grab the EIN from the IRS site the same day, and keep the paperwork in one folder. Do not overthink the name."}]'::jsonb,
  1, false, true
),
(
  (SELECT id FROM courses WHERE slug = 'llc-and-bank-setup'),
  'business-banking', 'Business Banking',
  'Open the account, separate the money, look professional on wires.',
  '[{"type":"video","youtube_id":"PLACEHOLDER"},{"type":"text","body":"A business checking account keeps your assignment fees clean for taxes and makes title companies take you seriously. Bring the LLC docs and EIN letter; it is a same-week task."},{"type":"action","label":"Grab the LLC and Bank Playbook","href":"https://realventurestudio.com"}]'::jsonb,
  2, false, true
)

ON CONFLICT (course_id, slug) DO NOTHING;
