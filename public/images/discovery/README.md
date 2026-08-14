# Consumer discovery editorial assets

These files are static visual inputs for the approved Zogular consumer-discovery homepage. They are not product records and must not be used to imply availability, price, seller identity, delivery, or a campaign.

## Provenance

- Created for Zogular on 2026-08-13 with OpenAI's built-in image-generation tool.
- No third-party or scraped image was used as an input.
- The generation brief required a generic, unbranded living-room scene with a calm left text-safe area and everyday goods on the right.
- The generated source contains no embedded text, logo, UI, price, badge, seller identity, delivery claim, or watermark.
- The 1536×1024 PNG generation master is intentionally not shipped. Only the two delivery crops below belong in the application repository.

## Delivery assets

| File | Dimensions | Purpose | Crop |
| --- | ---: | --- | --- |
| `home-editorial-mobile.webp` | 960×640 | Mobile and narrow-tablet hero | Full 3:2 composition, resized without upscaling |
| `home-editorial-desktop.webp` | 1536×512 | Wide desktop hero | Full source width, 512px-high crop beginning 288px from the source top |

Both files use lossy WebP quality 80. Next.js may create smaller responsive derivatives at request time. The separate crops are necessary because one source crop cannot preserve both the approved mobile 3:2 composition and the shallow desktop treatment without losing the text-safe area or the primary objects.

## Presentation contract

- Alt intent: decorative marketplace editorial scene; use empty alt text when the adjacent hero copy communicates the section.
- Keep copy in the dark left region and product imagery on the right.
- Do not present the pictured goods as real listings.
- Do not add promotional badges, prices, countdowns, seller claims, delivery claims, or embedded text to these files.
- Missing asset behavior must remain an honest non-image composition.
