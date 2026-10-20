import type {
  SubjectProperty,
  CompProperty,
  CompVerdict,
} from "./types";

// Format one comp's verdict for the UI. The category is authored in the
// scenario data; this only supplies William's copy. Plain English on
// purpose: no distances, months or sqft in the reason text.
export function scoreComp(
  subject: SubjectProperty,
  comp: CompProperty,
): CompVerdict {
  void subject;
  switch (comp.verdictCategory) {
    case "good":
      return {
        compId: comp.id,
        category: "good",
        isGood: true,
        headline: "Good comp",
        reason: "This one works. It sold for around the same price, close by, and around the same time. Use this.",
      };
    case "cherry_picked_high":
      return {
        compId: comp.id,
        category: "cherry_picked_high",
        isGood: false,
        headline: "Sold too high",
        reason: "This house is probably way nicer than yours. Skip it.",
      };
    case "cherry_picked_low":
      return {
        compId: comp.id,
        category: "cherry_picked_low",
        isGood: false,
        headline: "Sold too low",
        reason: "Someone probably lost money on this one. Skip it.",
      };
    case "different_neighborhood":
      return {
        compId: comp.id,
        category: "different_neighborhood",
        isGood: false,
        headline: "Different neighborhood",
        reason: "Houses over there sell for different prices. Not a real comp.",
      };
    case "wrong_size":
      return {
        compId: comp.id,
        category: "wrong_size",
        isGood: false,
        headline: "Wrong size",
        reason: "This one is a totally different size. Not a fair match.",
      };
  }
}
