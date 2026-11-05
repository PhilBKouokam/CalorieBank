import { z } from 'zod';
/** Presentation credits only; never an intake authority or accounting input. */
export const attributionProvidersSchema = z.array(z.literal('fatsecret'));
export type AttributionProviders = z.infer<typeof attributionProvidersSchema>;
