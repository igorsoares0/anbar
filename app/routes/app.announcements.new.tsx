import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation, Form, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  ButtonGroup,
  ColorPicker,
  RangeSlider,
  Text,
  BlockStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncAnnouncementBarsToMetafields } from "../utils/syncAnnouncementBars.server";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const announcementBar = await prisma.announcementBar.create({
      data: {
        shop: session.shop,
        name: formData.get("name") as string,
        announcementType: formData.get("announcementType") as string,
        title: formData.get("title") as string || null,
        subtitle: formData.get("subtitle") as string || null,
        discountCode: formData.get("discountCode") as string || null,
        callToAction: formData.get("callToAction") as string,
        link: formData.get("link") as string || null,
        showCloseIcon: formData.get("showCloseIcon") === "on",
        position: formData.get("position") as string,
        backgroundColor: formData.get("backgroundColor") as string,
        borderRadius: parseInt(formData.get("borderRadius") as string) || 0,
        borderWidth: parseInt(formData.get("borderWidth") as string) || 0,
        borderColor: formData.get("borderColor") as string,
        fontFamily: formData.get("fontFamily") as string,
        titleSize: parseInt(formData.get("titleSize") as string) || 16,
        titleColor: formData.get("titleColor") as string,
        subtitleSize: parseInt(formData.get("subtitleSize") as string) || 14,
        subtitleColor: formData.get("subtitleColor") as string,
        discountCodeColor: formData.get("discountCodeColor") as string,
        buttonColor: formData.get("buttonColor") as string,
        buttonTextSize: parseInt(formData.get("buttonTextSize") as string) || 14,
        buttonTextColor: formData.get("buttonTextColor") as string,
        buttonBorderRadius: parseInt(formData.get("buttonBorderRadius") as string) || 4,
        displayLocation: formData.get("displayLocation") as string,
        targetProducts: formData.get("targetProducts") ? JSON.parse(formData.get("targetProducts") as string) : null,
        targetCollections: formData.get("targetCollections") ? JSON.parse(formData.get("targetCollections") as string) : null,
        isPublished: formData.get("isPublished") === "on",
      },
    });

    // Automatically sync to theme metafields
    const syncResult = await syncAnnouncementBarsToMetafields(session, admin);
    if (!syncResult.success) {
      console.warn("Failed to sync announcement bars after creation:", syncResult.error);
    }

    return redirect(`/app/announcements/${announcementBar.id}`);
  } catch (error) {
    return json({ error: "Failed to create announcement bar" }, { status: 400 });
  }
};

export default function NewAnnouncementBar() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  // Form state
  const [name, setName] = useState("");
  const [announcementType, setAnnouncementType] = useState("simple");
  const [title, setTitle] = useState("Free shipping on orders over $50!");
  const [subtitle, setSubtitle] = useState("Limited time offer");
  const [discountCode, setDiscountCode] = useState("SAVE50");
  const [callToAction, setCallToAction] = useState("button");
  const [link, setLink] = useState("");
  const [showCloseIcon, setShowCloseIcon] = useState(true);
  const [position, setPosition] = useState("top");
  const [backgroundColor, setBackgroundColor] = useState({ hue: 220, brightness: 0.6, saturation: 0.8, alpha: 1 });
  const [borderRadius, setBorderRadius] = useState(0);
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState({ hue: 0, brightness: 0.3, saturation: 0, alpha: 1 });
  const [fontFamily, setFontFamily] = useState("Arial");
  const [titleSize, setTitleSize] = useState(16);
  const [titleColor, setTitleColor] = useState({ hue: 0, brightness: 0.95, saturation: 0, alpha: 1 });
  const [subtitleSize, setSubtitleSize] = useState(14);
  const [subtitleColor, setSubtitleColor] = useState({ hue: 0, brightness: 0.85, saturation: 0, alpha: 1 });
  const [discountCodeColor, setDiscountCodeColor] = useState({ hue: 60, brightness: 0.9, saturation: 1, alpha: 1 });
  const [buttonColor, setButtonColor] = useState({ hue: 210, brightness: 0.6, saturation: 0.8, alpha: 1 });
  const [buttonTextSize, setButtonTextSize] = useState(14);
  const [buttonTextColor, setButtonTextColor] = useState({ hue: 0, brightness: 1, saturation: 0, alpha: 1 });
  const [buttonBorderRadius, setButtonBorderRadius] = useState(4);
  const [displayLocation, setDisplayLocation] = useState("all_pages");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Debug effect to log color values
  useEffect(() => {
    console.log('Current backgroundColor state:', backgroundColor);
    console.log('Converted to HEX:', convertHsvaToHex(backgroundColor));
  }, [backgroundColor]);

  const openProductPicker = useCallback(() => {
    shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
    }).then((selection) => {
      setSelectedProducts(selection || []);
    }).catch((error) => {
      console.log('Product picker cancelled or error:', error);
    });
  }, [shopify]);

  const openCollectionPicker = useCallback(() => {
    shopify.resourcePicker({
      type: "collection",
      multiple: true,
      action: "select",
    }).then((selection) => {
      setSelectedCollections(selection || []);
    }).catch((error) => {
      console.log('Collection picker cancelled or error:', error);
    });
  }, [shopify]);

  const validateForm = useCallback(() => {
    const newErrors: {[key: string]: string} = {};
    
    if (!name.trim()) {
      newErrors.name = "Announcement name is required";
    }
    
    if (!title.trim() && !subtitle.trim()) {
      newErrors.content = "Either title or subtitle is required";
    }
    
    if (callToAction === "button" && !link.trim()) {
      newErrors.link = "Link is required when using a button";
    }
    
    if (callToAction === "full_bar" && !link.trim()) {
      newErrors.link = "Link is required when making the bar clickable";
    }
    
    if (link && !link.startsWith("http://") && !link.startsWith("https://") && !link.startsWith("/")) {
      newErrors.link = "Link must be a valid URL or path";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, title, subtitle, callToAction, link]);

  const announcementTypeOptions = [
    { label: "Simple", value: "simple" },
    { label: "Continuous scroll", value: "continuous" },
    { label: "Multiple with arrows", value: "multiple" },
  ];

  const callToActionOptions = [
    { label: "No call to action", value: "none" },
    { label: "Button", value: "button" },
    { label: "Make entire bar clickable", value: "full_bar" },
  ];

  const positionOptions = [
    { label: "Top of page", value: "top" },
    { label: "Bottom of page", value: "bottom" },
  ];

  const fontFamilyOptions = [
    { label: "Arial", value: "Arial" },
    { label: "Helvetica", value: "Helvetica" },
    { label: "Times New Roman", value: "Times New Roman" },
    { label: "Georgia", value: "Georgia" },
  ];

  const displayLocationOptions = [
    { label: "All pages", value: "all_pages" },
    { label: "Homepage only", value: "homepage" },
    { label: "All products in specific collections", value: "collections" },
    { label: "Specific product pages", value: "products" },
    { label: "All collection pages", value: "all_collections" },
    { label: "Specific collection pages", value: "specific_collections" },
    { label: "Cart page", value: "cart" },
    { label: "Custom position", value: "custom" },
  ];

  const convertHsvaToHex = (hsva: any) => {
    console.log('Converting HSVA to HEX:', hsva);
    const h = hsva.hue || 0;
    // Polaris outputs saturation and brightness as decimals (0-1), not percentages (0-100)
    const s = hsva.saturation || 0;
    const v = hsva.brightness || 0;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r, g, b;
    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .announcement-editor-layout {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 20px !important;
          }
          
          .editor-form-column {
            width: 100% !important;
          }
          
          .preview-column {
            position: sticky !important;
            top: 20px !important;
            height: fit-content !important;
            max-height: calc(100vh - 40px) !important;
            overflow-y: auto !important;
          }
          
          @media (max-width: 768px) {
            .announcement-editor-layout {
              grid-template-columns: 1fr !important;
            }
            
            .preview-column {
              position: static !important;
              height: auto !important;
              max-height: none !important;
            }
          }
          
          .preview-continuous {
            overflow: hidden !important;
            white-space: nowrap !important;
            position: relative !important;
          }
          
          .preview-continuous .preview-content {
            display: inline-block !important;
            white-space: nowrap !important;
            animation: preview-marquee 15s linear infinite !important;
            padding-left: 100% !important;
          }
          
          @keyframes preview-marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-100%, 0, 0); }
          }
          
          .preview-continuous:hover .preview-content {
            animation-play-state: paused !important;
          }
        `
      }} />
    <Page>
      <TitleBar
        title="Create announcement bar"
        breadcrumbs={[{ content: "Announcement bars", url: "/app/announcements" }]}
      />
      <div className="announcement-editor-layout">
        <div className="editor-form-column">
          <Form method="post">
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Content
                </Text>
                
                <FormLayout>
                  <TextField
                    label="Announcement name"
                    helpText="Visible only to you. For your internal reference."
                    value={name}
                    onChange={setName}
                    name="name"
                    required
                    error={errors.name}
                  />

                  <Select
                    label="Announcement type"
                    options={announcementTypeOptions}
                    value={announcementType}
                    onChange={setAnnouncementType}
                    name="announcementType"
                  />

                  <TextField
                    label="Title"
                    value={title}
                    onChange={setTitle}
                    name="title"
                    error={errors.content && !title.trim() && !subtitle.trim() ? errors.content : undefined}
                  />

                  <TextField
                    label="Subtitle"
                    value={subtitle}
                    onChange={setSubtitle}
                    name="subtitle"
                    error={errors.content && !title.trim() && !subtitle.trim() ? errors.content : undefined}
                  />

                  <TextField
                    label="Discount coupon code"
                    value={discountCode}
                    onChange={setDiscountCode}
                    name="discountCode"
                  />

                  <Select
                    label="Call to action"
                    options={callToActionOptions}
                    value={callToAction}
                    onChange={setCallToAction}
                    name="callToAction"
                  />

                  {(callToAction === "button" || callToAction === "full_bar") && (
                    <TextField
                      label="Link"
                      value={link}
                      onChange={setLink}
                      name="link"
                      placeholder="https://"
                      error={errors.link}
                    />
                  )}

                  <Checkbox
                    label="Show close icon"
                    checked={showCloseIcon}
                    onChange={setShowCloseIcon}
                    name="showCloseIcon"
                  />
                </FormLayout>

                <Divider />

                <Text as="h2" variant="headingLg">
                  Design
                </Text>

                <FormLayout>
                  <Select
                    label="Position"
                    options={positionOptions}
                    value={position}
                    onChange={setPosition}
                    name="position"
                  />

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Background color
                    </Text>
                    <ColorPicker
                      color={backgroundColor}
                      onChange={(color) => {
                        console.log('Background color changed:', color);
                        setBackgroundColor(color);
                      }}
                    />
                  </Box>

                  <TextField
                    label="Border radius (px)"
                    type="number"
                    value={borderRadius.toString()}
                    onChange={(value) => setBorderRadius(parseInt(value) || 0)}
                    name="borderRadius"
                  />

                  <TextField
                    label="Border width (px)"
                    type="number"
                    value={borderWidth.toString()}
                    onChange={(value) => setBorderWidth(parseInt(value) || 0)}
                    name="borderWidth"
                  />

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Border color
                    </Text>
                    <ColorPicker
                      color={borderColor}
                      onChange={(color) => {
                        console.log('Border color changed:', color);
                        setBorderColor(color);
                      }}
                    />
                  </Box>

                  <Select
                    label="Font family"
                    options={fontFamilyOptions}
                    value={fontFamily}
                    onChange={setFontFamily}
                    name="fontFamily"
                  />

                  <TextField
                    label="Title size (px)"
                    type="number"
                    value={titleSize.toString()}
                    onChange={(value) => setTitleSize(parseInt(value) || 16)}
                    name="titleSize"
                  />

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Title color
                    </Text>
                    <ColorPicker
                      color={titleColor}
                      onChange={(color) => {
                        console.log('Title color changed:', color);
                        setTitleColor(color);
                      }}
                    />
                  </Box>

                  <TextField
                    label="Subtitle size (px)"
                    type="number"
                    value={subtitleSize.toString()}
                    onChange={(value) => setSubtitleSize(parseInt(value) || 14)}
                    name="subtitleSize"
                  />

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Subtitle color
                    </Text>
                    <ColorPicker
                      color={subtitleColor}
                      onChange={(color) => {
                        console.log('Subtitle color changed:', color);
                        setSubtitleColor(color);
                      }}
                    />
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Discount code color
                    </Text>
                    <ColorPicker
                      color={discountCodeColor}
                      onChange={(color) => {
                        console.log('Discount code color changed:', color);
                        setDiscountCodeColor(color);
                      }}
                    />
                  </Box>

                  {callToAction === "button" && (
                    <>
                      <Box>
                        <Text as="p" variant="bodyMd">
                          Button color
                        </Text>
                        <ColorPicker
                          color={buttonColor}
                          onChange={(color) => {
                            console.log('Button color changed:', color);
                            setButtonColor(color);
                          }}
                        />
                      </Box>

                      <TextField
                        label="Button text size (px)"
                        type="number"
                        value={buttonTextSize.toString()}
                        onChange={(value) => setButtonTextSize(parseInt(value) || 14)}
                        name="buttonTextSize"
                      />

                      <Box>
                        <Text as="p" variant="bodyMd">
                          Button text color
                        </Text>
                        <ColorPicker
                          color={buttonTextColor}
                          onChange={(color) => {
                            console.log('Button text color changed:', color);
                            setButtonTextColor(color);
                          }}
                        />
                      </Box>

                      <TextField
                        label="Button border radius (px)"
                        type="number"
                        value={buttonBorderRadius.toString()}
                        onChange={(value) => setButtonBorderRadius(parseInt(value) || 4)}
                        name="buttonBorderRadius"
                      />
                    </>
                  )}
                </FormLayout>

                <Divider />

                <Text as="h2" variant="headingLg">
                  Location
                </Text>

                <FormLayout>
                  <Select
                    label="Display location"
                    options={displayLocationOptions}
                    value={displayLocation}
                    onChange={setDisplayLocation}
                    name="displayLocation"
                  />

                  {displayLocation === "products" && (
                    <div>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Select specific products where the announcement bar should appear
                      </Text>
                      <div style={{ marginTop: "8px" }}>
                        <Button onClick={openProductPicker}>
                          {selectedProducts.length > 0 
                            ? `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected`
                            : "Select products"
                          }
                        </Button>
                      </div>
                      {selectedProducts.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <Text as="p" variant="bodySm">
                            Selected: {selectedProducts.map(p => p.title).join(", ")}
                          </Text>
                        </div>
                      )}
                    </div>
                  )}

                  {displayLocation === "collections" && (
                    <div>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Select collections - announcement bar will appear on all products in these collections
                      </Text>
                      <div style={{ marginTop: "8px" }}>
                        <Button onClick={openCollectionPicker}>
                          {selectedCollections.length > 0 
                            ? `${selectedCollections.length} collection${selectedCollections.length > 1 ? 's' : ''} selected`
                            : "Select collections"
                          }
                        </Button>
                      </div>
                      {selectedCollections.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <Text as="p" variant="bodySm">
                            Selected: {selectedCollections.map(c => c.title).join(", ")}
                          </Text>
                        </div>
                      )}
                    </div>
                  )}

                  {displayLocation === "custom" && (
                    <div style={{ 
                      padding: "12px 16px", 
                      backgroundColor: "#fef7e0", 
                      borderRadius: "8px",
                      border: "1px solid #f1c40f"
                    }}>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Custom Positioning Instructions
                      </Text>
                      <Text as="p" variant="bodySm" style={{ marginTop: "8px" }}>
                        1. After creating this announcement bar, note its unique ID
                      </Text>
                      <Text as="p" variant="bodySm">
                        2. Go to your theme customizer
                      </Text>
                      <Text as="p" variant="bodySm">
                        3. Add the "Announcement Bar" app block where you want it to appear
                      </Text>
                      <Text as="p" variant="bodySm">
                        4. Enter the announcement bar ID in the block settings
                      </Text>
                    </div>
                  )}
                </FormLayout>

                <Divider />

                <FormLayout>
                  <Checkbox
                    label="Publish announcement bar"
                    checked={isPublished}
                    onChange={setIsPublished}
                    name="isPublished"
                  />
                </FormLayout>

                {actionData?.error && (
                  <Text as="p" variant="bodyMd" tone="critical">
                    {actionData.error}
                  </Text>
                )}

                <ButtonGroup>
                  <Button 
                    variant="primary" 
                    loading={isLoading}
                    onClick={() => {
                      if (validateForm()) {
                        const formData = new FormData();
                        formData.append("name", name);
                        formData.append("announcementType", announcementType);
                        formData.append("title", title);
                        formData.append("subtitle", subtitle);
                        formData.append("discountCode", discountCode);
                        formData.append("callToAction", callToAction);
                        formData.append("link", link);
                        formData.append("showCloseIcon", showCloseIcon ? "on" : "");
                        formData.append("position", position);
                        formData.append("backgroundColor", convertHsvaToHex(backgroundColor));
                        formData.append("borderRadius", borderRadius.toString());
                        formData.append("borderWidth", borderWidth.toString());
                        formData.append("borderColor", convertHsvaToHex(borderColor));
                        formData.append("fontFamily", fontFamily);
                        formData.append("titleSize", titleSize.toString());
                        formData.append("titleColor", convertHsvaToHex(titleColor));
                        formData.append("subtitleSize", subtitleSize.toString());
                        formData.append("subtitleColor", convertHsvaToHex(subtitleColor));
                        formData.append("discountCodeColor", convertHsvaToHex(discountCodeColor));
                        formData.append("buttonColor", convertHsvaToHex(buttonColor));
                        formData.append("buttonTextSize", buttonTextSize.toString());
                        formData.append("buttonTextColor", convertHsvaToHex(buttonTextColor));
                        formData.append("buttonBorderRadius", buttonBorderRadius.toString());
                        formData.append("displayLocation", displayLocation);
                        formData.append("targetProducts", JSON.stringify(selectedProducts.map(p => p.id)));
                        formData.append("targetCollections", JSON.stringify(selectedCollections.map(c => c.id)));
                        formData.append("isPublished", isPublished ? "on" : "");
                        
                        submit(formData, { method: "post" });
                      }
                    }}
                  >
                    Create announcement bar
                  </Button>
                  <Button url="/app/announcements">Cancel</Button>
                </ButtonGroup>
              </BlockStack>
            </Card>
          </Form>
        </div>

        <div className="preview-column">
          <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Preview
                </Text>
              
              <Box
                padding="400"
                borderRadius="200"
              >
                <div
                  className={announcementType === "continuous" ? "preview-continuous" : ""}
                  style={{
                    backgroundColor: convertHsvaToHex(backgroundColor),
                    borderRadius: `${borderRadius}px`,
                    border: `${borderWidth}px solid ${convertHsvaToHex(borderColor)}`,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontFamily: fontFamily,
                  }}
                >
                  <div 
                    className={announcementType === "continuous" ? "preview-content" : ""}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    {title && (
                      <span
                        style={{
                          fontSize: `${titleSize}px`,
                          color: convertHsvaToHex(titleColor),
                          fontWeight: "bold",
                        }}
                      >
                        {title}
                      </span>
                    )}
                    {subtitle && (
                      <span
                        style={{
                          fontSize: `${subtitleSize}px`,
                          color: convertHsvaToHex(subtitleColor),
                        }}
                      >
                        {subtitle}
                      </span>
                    )}
                    {discountCode && (
                      <span
                        style={{
                          fontSize: `${titleSize}px`,
                          color: convertHsvaToHex(discountCodeColor),
                          fontWeight: "bold",
                          textDecoration: "underline",
                        }}
                      >
                        {discountCode}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {callToAction === "button" && (
                      <button
                        style={{
                          backgroundColor: convertHsvaToHex(buttonColor),
                          color: convertHsvaToHex(buttonTextColor),
                          fontSize: `${buttonTextSize}px`,
                          borderRadius: `${buttonBorderRadius}px`,
                          border: "none",
                          padding: "6px 12px",
                          cursor: "pointer",
                        }}
                      >
                        Shop Now
                      </button>
                    )}
                    {showCloseIcon && (
                      <span
                        style={{
                          color: convertHsvaToHex(titleColor),
                          cursor: "pointer",
                          fontSize: "18px",
                        }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                </div>
              </Box>
            </BlockStack>
          </Card>
        </div>
      </div>
    </Page>
    </>
  );
}