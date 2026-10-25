// Artwork for scenario content, keyed by scenario ID. Content without art falls back to an icon
// tile, so a content author can add a scenario without adding images.
import pharmacy from '../assets/art/pharmacy.png';
import sofa from '../assets/art/sofa.jpg';

const EVENT_ART = new Map<string, string>([['pharmacy', pharmacy]]);
const OFFER_ART = new Map<string, string>([['sofa', sofa]]);

export function eventArt(eventId: string): string | undefined {
  return EVENT_ART.get(eventId);
}

export function offerArt(offerId: string): string | undefined {
  return OFFER_ART.get(offerId);
}
