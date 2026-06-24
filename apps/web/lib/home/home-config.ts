/**
 * home-config — the company's root surface (company-root-landing-001 +
 * homepage-composition-001). Written by provisioning (_step_substrate_install)
 * from the homepage composer / CTO home_mode + CMO positioning. Do NOT hand-edit.
 */
export interface HomeCta {
  label: string;
  href: string;
}

export interface HomeFeature {
  title: string;
  body: string;
}

export interface SectionImage {
  url?: string;
  alt?: string;
  caption?: string;
}

export interface HeroSection {
  type: "hero";
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  image?: SectionImage;
}
export interface StatsSection {
  type: "stats";
  title?: string;
  stats: { value: string; label: string }[];
}
export interface HowItWorksSection {
  type: "how_it_works";
  title?: string;
  subhead?: string;
  steps: { title: string; body: string }[];
}
export interface FeatureGridSection {
  type: "feature_grid";
  title?: string;
  subhead?: string;
  features: HomeFeature[];
}
export interface FeatureSpotlightSection {
  type: "feature_spotlight";
  title?: string;
  items: { title: string; body: string; image?: SectionImage }[];
}
export interface SocialProofSection {
  type: "social_proof";
  title?: string;
  quotes: { quote: string; author?: string; role?: string }[];
}
export interface FaqSection {
  type: "faq";
  title?: string;
  items: { q: string; a: string }[];
}
export interface PricingTeaserSection {
  type: "pricing_teaser";
  title?: string;
  subhead?: string;
  tiers: {
    name: string;
    price?: string;
    period?: string;
    features: string[];
    cta?: HomeCta;
    highlighted?: boolean;
  }[];
}
export interface GallerySection {
  type: "gallery";
  title?: string;
  images: SectionImage[];
}
export interface CtaBandSection {
  type: "cta_band";
  headline: string;
  subhead?: string;
  cta?: HomeCta;
}

export type HomeSection =
  | HeroSection
  | StatsSection
  | HowItWorksSection
  | FeatureGridSection
  | FeatureSpotlightSection
  | SocialProofSection
  | FaqSection
  | PricingTeaserSection
  | GallerySection
  | CtaBandSection;

export interface HomeConfig {
  mode: "landing" | "conversation";
  sections?: HomeSection[];
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  featuresTitle?: string;
  features?: HomeFeature[];
  closingHeadline?: string;
}

export const homeConfig: HomeConfig = {
  "mode": "landing",
  "headline": "Your shoes. Your design. Printed to order \u2014 not pulled from a warehouse.",
  "subhead": "Nexus is the only direct-to-consumer footwear brand where you design your own casual-to-semi-dress shoes in a browser-based 3D configurator and receive a structurally validated, 3D-printed pair in 7\u201314 days \u2014 targeting the silhouette gap\u2026",
  "sections": [
    {
      "type": "hero",
      "headline": "Design the exact shoe your outfit has been waiting for",
      "eyebrow": "Made-to-order footwear, built in your browser",
      "subhead": "Solework's 3D design studio lets you dial in color, silhouette, and fit \u2014 then our AI validates the design before you pay, so your custom pair arrives wearable, not just printable.",
      "primaryCta": {
        "label": "Open the Design Studio",
        "href": "/studio"
      },
      "secondaryCta": {
        "label": "Shop Best-Sellers",
        "href": "/shop"
      },
      "image": {
        "url": "hero_image"
      }
    },
    {
      "type": "stats",
      "stats": [
        {
          "value": "7\u201314 days",
          "label": "Made-to-order delivery, coast to coast"
        },
        {
          "value": "2\u20133 days",
          "label": "Best-seller shipping from pre-printed stock"
        },
        {
          "value": "0 failed prints",
          "label": "AI constraint engine validates every design before checkout"
        },
        {
          "value": "100+",
          "label": "Color, texture, and sole combinations in the studio"
        }
      ],
      "title": "Precision you can feel. Numbers that back it up."
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Design in the 3D studio",
          "body": "Choose a silhouette \u2014 loafer, derby, mule, or sneaker \u2014 then adjust upper color, texture finish, sole profile, and toe shape in real time. The studio renders your pair in photorealistic studio light as you work."
        },
        {
          "title": "AI validates your design",
          "body": "Our constraint engine checks structural integrity, print feasibility, and fit geometry against your size inputs before you ever reach checkout. If something needs a tweak, it tells you exactly what to change."
        },
        {
          "title": "Approve and order",
          "body": "Lock in your design, confirm your size, and pay once \u2014 no subscription, no hidden fees. Custom orders enter the print queue immediately; best-sellers ship from pre-printed stock within 2\u20133 days."
        },
        {
          "title": "Receive a finished pair",
          "body": "Your shoes arrive post-processed and hand-finished at our studio: sanded, sealed, and paired with a branded box. Custom orders land in 7\u201314 days. Wear them the weekend they arrive."
        }
      ],
      "title": "From blank canvas to your doorstep",
      "subhead": "Four unhurried steps between you and a pair of shoes that actually match the outfit."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "A design studio that respects your time \u2014 and your taste",
          "body": "The browser-based 3D studio is built for people who know what they want, not for engineers. Pick from curated material palettes \u2014 matte terracotta, warm chalk, deep espresso \u2014 drag sliders to widen the toe box, and see your changes reflected instantly. Save multiple colorways and share a link before you commit. No app download, no account required to explore.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/5822d27a-85e3-485c-b566-aedc3cc67212",
            "alt": "A design studio that respects your time \u2014 and your taste"
          }
        },
        {
          "title": "The AI constraint engine: your invisible co-designer",
          "body": "Earlier 3D footwear brands failed because a beautiful render didn't guarantee a wearable shoe. Solework's constraint engine runs structural and fit checks continuously as you design \u2014 flagging wall thickness issues, sole flex zones, and width-to-arch ratios in real time. By the time you hit checkout, the pair has already passed a silent quality review. That's the guarantee no off-the-shelf brand c",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/3b0ac879-cddc-4e85-9fd9-c6acd68353a4",
            "alt": "The AI constraint engine: your invisible co-designer"
          }
        },
        {
          "title": "Best-sellers for when you need it Tuesday",
          "body": "Not every purchase is a custom project. Solework stocks its highest-rated silhouettes in the most common sizes, pre-printed and ready to ship in 2\u20133 days. Same 3D-printed construction, same hand-finish \u2014 just no wait. Filter by occasion (conference, wedding guest, date night) or by color family and find something that ships before the weekend.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/2195243f-3581-4751-8017-036d68d0e500",
            "alt": "Best-sellers for when you need it Tuesday"
          }
        }
      ],
      "title": "The details that make the difference"
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "Silhouette library",
          "body": "Choose from casual loafers, clean derbies, block-heel mules, and low-profile sneakers \u2014 each engineered for 3D printing from the sole up."
        },
        {
          "title": "Width and fit inputs",
          "body": "Enter your standard size plus width preference (narrow, standard, wide) and the studio adjusts the last geometry before printing \u2014 no insole workaround required."
        },
        {
          "title": "Material and color palettes",
          "body": "Over 100 curated finish combinations across matte, satin, and textured surfaces. Palettes are updated seasonally so your options stay current."
        },
        {
          "title": "Design save and share",
          "body": "Save up to five designs to your account, revisit them anytime, or share a live preview link with a partner, stylist, or wedding planner before ordering."
        },
        {
          "title": "Occasion filters",
          "body": "Shopping for a specific event? Filter best-sellers and studio starting points by occasion \u2014 work conference, wedding guest, date night \u2014 to narrow the field fast."
        },
        {
          "title": "Gift ordering",
          "body": "Purchase a custom design as a gift: the recipient receives a link to confirm their size before the order enters the print queue, so fit is never a guess."
        }
      ],
      "title": "Everything the studio can do",
      "subhead": "Capabilities built for the person who couldn't find the right shoe anywhere else."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "I needed a dusty-rose loafer for a wedding and every store had beige or blush \u2014 nothing in between. Solework matched the exact swatch from my dress fabric. They arrived five days before the wedding and I've worn them three times since.",
          "author": "Wedding guest",
          "role": "Chicago, IL"
        },
        {
          "quote": "As someone with a wide foot, I've spent years buying shoes a half-size up and hoping for the best. The width input actually changed the geometry \u2014 I could feel it the moment I put them on. This is what custom should mean.",
          "author": "Marketing director",
          "role": "Austin, TX"
        },
        {
          "quote": "I bought a best-seller pair on a Monday and wore them to a client presentation Thursday. The finish looks more like premium leather goods than anything I expected from a printed shoe. Genuinely impressive.",
          "author": "UX designer",
          "role": "Brooklyn, NY"
        }
      ],
      "title": "What people are saying"
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "Are 3D-printed shoes actually durable enough for daily wear?",
          "a": "Solework uses flexible, impact-resistant polymer composites engineered specifically for footwear loads. Every silhouette is stress-tested for flex cycles at the ball of the foot and heel strike zones. The post-processing seal protects the surface from moisture and scuffing. They're built to outlast a trend, not just a photoshoot."
        },
        {
          "q": "What if the design I create doesn't actually fit when it arrives?",
          "a": "The AI constraint engine validates your width and arch inputs against the chosen last before the order is placed \u2014 so structural fit issues are caught before printing, not after delivery. If a pair arrives with a manufacturing defect, we reprint and reship at no charge."
        },
        {
          "q": "How is a 14-day turnaround possible for a fully custom shoe?",
          "a": "Because the design is already validated and file-ready at checkout, the print queue starts immediately. Most custom orders complete printing in 3\u20135 days; the remaining time is post-processing, finishing, and shipping. We don't hold orders for batch runs."
        },
        {
          "q": "What size range do you carry?",
          "a": "The custom studio supports US women's 5\u201313 and US men's 6\u201314, including half sizes and three width options. Best-seller stock covers the most common sizes; if yours isn't in stock, the custom studio always can."
        },
        {
          "q": "Can I return or exchange a custom pair?",
          "a": "Custom orders are made specifically for you, so we don't accept returns for change of mind. We do remake any pair with a verified fit or manufacturing defect. Best-seller stock orders follow a standard 30-day return policy for unworn pairs."
        }
      ],
      "title": "Honest answers to fair questions"
    },
    {
      "type": "cta_band",
      "headline": "Your next pair is one design session away",
      "subhead": "Open the studio, find your silhouette, and let the AI handle the hard part. No account required to start designing."
    }
  ]
};
