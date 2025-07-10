# Shopify App for Creating Announcement Bar

## The announcement bar editor should have:

**Content:**

- Announcement type: simple, continuous list (automatically scrolled from right to left) or multiple (with arrows to pull left/right);
- Announcement name (Visible only to you. For your internal reference.);
- Title;
- Subtitle;
- Discount coupon code;
- Call to action: button, no call to action or make the entire bar clickable;
- Link;
- Close icon (can be checked or unchecked);

**Design:**

- Positioning: top or bottom of page;
- Announcement bar: background color, border radius (in px), border (in px), border color;
- Typography: basic typefaces to choose, title size (in px) and color, subtitle size (px) and color;
- Discount code: text color;
- Button: button color, button text size (in px) and color, border radius;

**Location (Select pages to display the bar):**

- The user must choose whether to show the bar on pages or on the cart page (if they choose cart page, it will only be allowed to show the announcement bar at the top of the cart and the other options - listed below - should not be shown);
- All pages;
- Homepage only;
- All products in specific collections (resource picker to select collections);
- Specific product pages (resource picker to select products);
- All collection pages;
- Specific collection pages;
- Custom position (using a unique id for each announcement bar, to be inserted/pasted in an app block)

## Other important information:

- 'Publish' button

- The editing bar should be on the left side of the interface and on the right side there should be a real-time preview bar of the announcement bar (like the image in attachment).

- It should be possible to edit, list and delete an already created announcement bar.

- Every announcement bar should have a unique id.

- It should be possible to activate and deactivate an announcement bar.

- The store owner can use both the app embed block to insert the bar in the store and an app block (where they insert the announcement bar id and can move it around through the theme editor)

- Announcement bars should be mobile-friendly

- use file-based routing with nested routes