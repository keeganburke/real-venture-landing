export type ResourceLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type ResourceDownload = {
  label: string;
  href: string; // path under /public
  size?: string;
};

export type Resource = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  content: string; // long-form text, uses \n\n for paragraph breaks
  links?: ResourceLink[];
  downloads?: ResourceDownload[];
  image?: string;
};

export const RESOURCES: Resource[] = [
  {
    id: "on-market-offer",
    emoji: "📝",
    title: "On-market Offer Template",
    description: "Copy-paste script for submitting on-market offers as an unrepresented buyer.",
    content: "We're an unrepresented buyer, so if you would please present this offer and then write up the PSA once approved that would be great. Please send it over to (insert email). Thank you.\n\n(Insert Approved Price) All cash. 14 day inspection period. $500 EMD. 30 day close.\n\nBuyers agent fee: Not Applicable / Seller pays buyers agent commission if you are to represent me. Buyer pays traditional closing costs for buyer's side.\n\nUsing (insert wholesale friendly title co) as our title company. Buyer: (insert buyers name).\n\nWhat This Does: This message is designed to help you submit offers on-market while protecting your position and maximizing profit. By stating you are an unrepresented buyer, you are making it clear that you are not working with an agent. This forces the listing agent to write the contract for you, saving you time and keeping control of the deal."
  },
  {
    id: "wholesaling-terms",
    emoji: "📚",
    title: "Wholesaling Terms",
    description: "The core vocabulary. Learn these cold before your first call.",
    content: "🔒 SECURED WHOLESALING\nOur buyer-first method: lock in a cash buyer's criteria and commitment before you ever sign with a seller.\n· Kills the #1 reason wholesalers fail: deals dying with no buyer\n· You hunt deals that fit a known buyer instead of hoping one shows up\n· Removes most of the risk that makes beginners quit\n\n💰 ASSIGNMENT FEE\nThe money you make for transferring your contract to the end buyer.\n· The gap between your contract price and the buyer's price\n· Collected at closing through the title company\n· Shown on the settlement statement or via a separate assignment agreement\n\n📊 ARV: After Repair Value\nWhat the property is worth fully fixed up, based on comparable sales.\n· The number everything else is built on\n· Pulled from recent sold comps, not the Zillow estimate\n· Buyers care about this more than almost anything\n\n🔍 COMPS: Comparables\nRecently sold properties similar to yours, used to estimate ARV.\n· Same area, similar size/beds/baths, sold in the last 3 to 6 months\n· Sold comps only. Active listings are asking prices, not proof\n· Tighter radius plus recent dates = more accurate number\n\n🧮 MAO: Maximum Allowable Offer\nThe highest you can offer a seller and still leave room for profit.\n· Common formula: (ARV × 0.70) minus repairs minus your fee\n· Keeps you from overpaying and killing the spread\n· It's a ceiling, not a target. Offer below it when you can\n\n📐 70% RULE\nInvestors typically pay up to 70% of ARV minus repairs.\n· Fast way to check if a deal even has room\n· Tighter (65%) in slow markets, looser (75%+) in hot ones\n· A filter, not a law. Your buyer's real numbers win\n\n🔧 REPAIR COSTS (Rehab)\nThe estimated cost to bring the property to ARV condition.\n· Underestimating this is how you lose a buyer's trust\n· Know rough dollars per sqft ranges for your market cold\n· When unsure, estimate high. Buyers forgive conservative, not optimistic\n\n📈 SPREAD\nThe gap between your contract price and what the buyer pays.\n· Your assignment fee lives inside the spread\n· Bigger spread = more room to negotiate and still profit\n· Thin spreads die fast when repairs come in higher\n\n😬 MOTIVATED SELLER\nA seller with a real reason to sell fast, the source of nearly every deal.\n· Drivers: foreclosure, divorce, inheritance, tired landlord, relocation\n· They value speed and certainty over top dollar\n· Solve their problem first; the discount follows\n\n📝 PSA: Purchase & Sale Agreement\nThe contract with the seller that gives you the right to buy (and assign).\n· Must include assignment rights and an inspection/exit clause\n· This is what you're actually selling to your buyer\n· Whoever controls the contract controls the deal"
  },
  {
    id: "pof",
    emoji: "💸",
    title: "Proof of Funds",
    description: "The current POF for one of our VIP buyers. Use to secure verbal agreements.",
    content: "This is the current proof of funds for one of our VIP buyers. You're cleared to use this POF to secure verbal agreements on your offers.\n\nOnce we have buyer commitment and we're ready to sign the contract, Real Venture will issue a personalized proof of funds PDF for that specific deal.\n\nLock in the verbal first. Then once the underwriting team approves and we have buyer commitment, we'll get you the official POF to close.",
    image: "/resources/pof.png"
  },
  {
    id: "llc-and-bank-setup",
    emoji: "🏦",
    title: "LLC & Business Bank Account Setup",
    description: "Get an LLC and business bank account once you're closing deals.",
    content: "Once you're closing deals, getting an LLC and a business bank account makes you more legit, protects you, and keeps your money organized. Here's the simple version.\n\nDo you need an LLC to start?\nNo. You can do your first deal or two without one. But it's recommended to get set up early just to be safe.\n\nWhat an LLC actually does:\nIt limits your liability and separates your business assets from your personal name. If anything ever goes wrong, your personal stuff (house, savings, etc.) stays protected. It also just makes you look more professional to agents, sellers, and buyers.\n\nTwo ways to file:\n\n⚡ Rushfiling (the fast option)\nFiles your LLC in 24 hours or same-day in most states. Go this route if you want to move quick and get set up ASAP.\n\n🟢 Bizee (the beginner-friendly option)\n$0 to file (you just pay your state fee) and super simple to use. Great if you're not in a rush and want the cheapest path.\n\nPricing to expect either way:\nState filing fee: about $40 to $200+ depending on your state (this goes to the state, not the service).\nRushfiling: pricing varies by state, check their site for your quote.\nBizee: $0 + state fee for basic filing. Additional cost for EIN.\n\nTip: grab your EIN while you're at it, you'll need it to open your bank account.\n\n💳 Business Bank Account\nOnce your LLC is set up, open a business bank account. This keeps your business money completely separate from your personal money, which is the whole point of having an LLC in the first place.\n\nWhy it matters:\nThis is where you'll receive your assignment fees and pay any business expenses (like paying someone to walk a property for you). Keeping it separate keeps your books clean, protects your liability shield, and makes tax season way easier.\n\nWhat we use: Mercury\nIt's free, built for online businesses, and the setup is super simple. No monthly fees, no minimums.\n\nHow to set it up:\n1. Have your LLC formed and your EIN ready\n2. Go to Mercury and create an account (takes about 10 to 15 min) and you'll get your account + debit card shortly after\n\nAny questions on any of this, drop them in the Discord and we'll walk you through it.",
    links: [
      { label: "Rushfiling", href: "https://rushfiling.com/", external: true },
      { label: "Bizee", href: "https://bizee.com/", external: true },
      { label: "Mercury", href: "https://mercury.com/", external: true }
    ]
  },
  {
    id: "virtual-assistant-setup",
    emoji: "📞",
    title: "Virtual Assistant Setup",
    description: "Two docs: hire a VA, get them dialing, start getting warm leads.",
    content: "VA Step-by-step. Two docs below. Everything you need to hire a VA, get them dialing, and start getting warm leads flowing.\n\n📘 VA System SOP\nSetup, the lead flow, and exactly what to do when a deal hits your phone.\n\n📄 VA Cold Call Script\nForward this one straight to your VA. Opener, qualifying questions, the close, and how they hand off leads.\n\nHow it works:\n🗣️ Your VA dials + qualifies →\n📲 texts you the warm lead →\n💰 you make the offer and close.",
    downloads: [
      { label: "VA System SOP", href: "/resources/va-sop.pdf" },
      { label: "VA Cold Call Script", href: "/resources/va-cold-call-script.pdf" }
    ]
  },
  {
    id: "contract-templates",
    emoji: "📄",
    title: "Contract Templates",
    description: "PSAs, assignment agreements, and other core contract files.",
    content: "Coming soon. Templates will drop here as they're prepped for release.\n\nFor now, ask in the Discord and we'll send you what you need for your specific deal."
  }
];
