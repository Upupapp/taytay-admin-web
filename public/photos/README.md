# `public/photos/` — photographs

Photographs the console shows as decoration. They are not brand assets (those are in
`public/brand/`, held by the asset manifest) and not data: no photograph here shows a resident, a
beneficiary or anything from a record. Every file is self-hosted, because the CSP allows images
only from the console's own origin (`img-src 'self' data: blob:`).

| File                              | Pixels, bytes       | Used by                              | Record   |
| --------------------------------- | ------------------- | ------------------------------------ | -------- |
| `taytay-municipal-hall-900.webp`  | 900 × 1128, 63,140  | Sign-in photograph panel, 1x screens | `DL-243` |
| `taytay-municipal-hall-1200.webp` | 1200 × 1504, 99,908 | Sign-in photograph panel, 2x screens | `DL-243` |

## Taytay Municipal Hall

- **Source:** [File:993Taytay, Rizal Roads Landmarks Buildings 04.jpg](https://commons.wikimedia.org/wiki/File:993Taytay,_Rizal_Roads_Landmarks_Buildings_04.jpg),
  Wikimedia Commons, category _Taytay Municipal Hall_.
- **Author:** Judgefloro (own work), taken 25 July 2018.
- **Licence:** CC0 1.0, Creative Commons Public Domain Dedication
  (<https://creativecommons.org/publicdomain/zero/1.0/>), as the file page states. CC0 asks for
  no credit; the sign-in panel gives one anyway: _Photo: Taytay Municipal Hall by Judgefloro, CC0,
  via Wikimedia Commons._
- **Retrieved:** 23 November 2026. The original, 3456 × 4608 JPEG, 5,648,064 bytes, matched the
  SHA-1 Commons records for it (`21e753abe36e5ea4d6c0b75ffd1a11290aa9d70c`). It is not kept here.
- **What was changed, and why:**
  - The people on the hall's top landing and at its door, about eight, small and incidental, are
    blurred under a feathered mask. Four of them face the camera. On a social welfare console a
    visitor at the municipal hall could be read as somebody seeking help, so no face is left that
    could be recognised.
  - The top 6% (276 px of the original), sky blown out to white, is cropped away; it glared
    through the panel's veil. The result is 3456 × 4332.
  - Contrast 1.06 and saturation 1.08, to lift the flat overcast light a little.
  - Scaled to 900 and 1200 px wide with Lanczos and encoded as WebP at quality 80 with the metadata
    removed. Both copies have the same crop.
  - The perspective was not corrected: the columns lean in because the photo was taken looking up.

  The ffmpeg steps, on the original:

  ```text
  # 1. the mask: white over the people, feathered
  -f lavfi -i "color=black:s=3456x4608:d=1,format=gray,
     drawbox=x=1357:y=2566:w=808:h=455:color=white:t=fill,
     drawbox=x=1098:y=2661:w=267:h=239:color=white:t=fill,gblur=sigma=12" -frames:v 1 mask.png
  # 2. the master: blur through the mask (lifted to full white at its centre), trim the sky,
  #    lift the light
  -i original.jpg -i mask.png -filter_complex "[0:v]format=gbrp,split=2[base][b];
     [b]boxblur=32:4[bl];[1:v]format=gray,lut=y='clip(val*1.3,0,255)',format=gbrp[m];[base][bl][m]maskedmerge,
     crop=3456:4332:0:276,eq=contrast=1.06:saturation=1.08" -frames:v 1 master.png
  # 3. each copy
  -i master.png -vf scale=900:1128:flags=lanczos   (and 1200:1504)
     -c:v libwebp -preset photo -quality 80 -compression_level 6 -map_metadata -1
  ```

  SHA-256: `taytay-municipal-hall-900.webp`
  `5dd735450f90d2fe8eedbd92ad04d48c99acc195197defab49aeeb18fe1dc905`,
  `taytay-municipal-hall-1200.webp`
  `2f48efcc15aa3431537a4f059a574970c56a0acc303435a763d3729e63f78fca`.

## To add or replace a photograph

1. **Use a photograph you may use.** Prefer CC0, CC BY or CC BY-SA from Wikimedia Commons, and
   read the licence on the file page itself. Under CC BY or CC BY-SA the credit on screen is
   required: the author, the licence and the source.
2. **Show no resident and imply no beneficiary.** A public place with nobody in it is the
   easiest choice. Blur any recognisable face of a private person before the file comes here.
3. **Self-host it.** Download it into its own empty folder outside the repository, make the
   copies with ffmpeg, and place only the copies here. Keep each one under 250 KB.
4. **Declare it only where it is shown.** A background goes inside the media query in which its
   panel is visible, so a screen that hides the panel never fetches it.
5. **Record it** in the table and a section above, with the source URL, author, licence and the
   date it was retrieved, and credit it on screen.
