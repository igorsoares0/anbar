import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form, useSubmit } from "@remix-run/react";
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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const announcementBar = await prisma.announcementBar.findFirst({
    where: { id, shop: session.shop },
  });

  if (!announcementBar) {
    throw new Response("Not found", { status: 404 });
  }

  return json({ announcementBar });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();

  const _action = formData.get("_action");

  if (_action === "delete") {
    await prisma.announcementBar.delete({
      where: { id, shop: session.shop },
    });
    
    // Automatically sync after deletion
    const syncResult = await syncAnnouncementBarsToMetafields(session, admin);
    if (!syncResult.success) {
      console.warn("Failed to sync announcement bars after deletion:", syncResult.error);
    }
    
    return redirect("/app/announcements");
  }

  if (_action === "toggle") {
    const announcementBar = await prisma.announcementBar.findFirst({
      where: { id, shop: session.shop },
    });
    
    if (announcementBar) {
      await prisma.announcementBar.update({
        where: { id },
        data: { isActive: !announcementBar.isActive },
      });
      
      // Automatically sync after toggle
      const syncResult = await syncAnnouncementBarsToMetafields(session, admin);
      if (!syncResult.success) {
        console.warn("Failed to sync announcement bars after toggle:", syncResult.error);
      }
    }
    return json({ success: true });
  }

  try {
    await prisma.announcementBar.update({
      where: { id, shop: session.shop },
      data: {
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

    // Automatically sync after update
    const syncResult = await syncAnnouncementBarsToMetafields(session, admin);
    if (!syncResult.success) {
      console.warn("Failed to sync announcement bars after update:", syncResult.error);
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: "Failed to update announcement bar" }, { status: 400 });
  }
};

export default function EditAnnouncementBar() {
  const { announcementBar } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  // Form state initialized with existing data
  const [name, setName] = useState(announcementBar.name);
  const [announcementType, setAnnouncementType] = useState(announcementBar.announcementType);
  const [title, setTitle] = useState(announcementBar.title || "");
  const [subtitle, setSubtitle] = useState(announcementBar.subtitle || "");
  const [discountCode, setDiscountCode] = useState(announcementBar.discountCode || "");
  const [callToAction, setCallToAction] = useState(announcementBar.callToAction);
  const [link, setLink] = useState(announcementBar.link || "");
  const [showCloseIcon, setShowCloseIcon] = useState(announcementBar.showCloseIcon);
  const [position, setPosition] = useState(announcementBar.position);
  const [backgroundColor, setBackgroundColor] = useState(hexToHsva(announcementBar.backgroundColor));
  const [borderRadius, setBorderRadius] = useState(announcementBar.borderRadius);
  const [borderWidth, setBorderWidth] = useState(announcementBar.borderWidth);
  const [borderColor, setBorderColor] = useState(hexToHsva(announcementBar.borderColor));
  const [fontFamily, setFontFamily] = useState(announcementBar.fontFamily);
  const [titleSize, setTitleSize] = useState(announcementBar.titleSize);
  const [titleColor, setTitleColor] = useState(hexToHsva(announcementBar.titleColor));
  const [subtitleSize, setSubtitleSize] = useState(announcementBar.subtitleSize);
  const [subtitleColor, setSubtitleColor] = useState(hexToHsva(announcementBar.subtitleColor));
  const [discountCodeColor, setDiscountCodeColor] = useState(hexToHsva(announcementBar.discountCodeColor));
  const [buttonColor, setButtonColor] = useState(hexToHsva(announcementBar.buttonColor));
  const [buttonTextSize, setButtonTextSize] = useState(announcementBar.buttonTextSize);
  const [buttonTextColor, setButtonTextColor] = useState(hexToHsva(announcementBar.buttonTextColor));
  const [buttonBorderRadius, setButtonBorderRadius] = useState(announcementBar.buttonBorderRadius);
  const [displayLocation, setDisplayLocation] = useState(announcementBar.displayLocation);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [isPublished, setIsPublished] = useState(announcementBar.isPublished);

  function hexToHsva(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let hue = 0;
    if (diff !== 0) {
      if (max === r) {
        hue = ((g - b) / diff) % 6;
      } else if (max === g) {
        hue = (b - r) / diff + 2;
      } else {
        hue = (r - g) / diff + 4;
      }
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;

    const saturation = max === 0 ? 0 : (diff / max);
    const brightness = max;

    return { hue, saturation, brightness, alpha: 1 };
  }

  const convertHsvaToHex = (hsva: any) => {
    const h = hsva.hue || 0;
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
        title={`Edit: ${announcementBar.name}`}
        breadcrumbs={[{ content: "Announcement bars", url: "/app/announcements" }]}
        secondaryActions={[
          {
            content: announcementBar.isActive ? "Deactivate" : "Activate",
            onAction: () => {
              const formData = new FormData();
              formData.append("_action", "toggle");
              fetch(`/app/announcements/${announcementBar.id}`, {
                method: "POST",
                body: formData,
              }).then(() => window.location.reload());
            },
          },
          {
            content: "Delete",
            destructive: true,
            onAction: () => {
              if (confirm("Are you sure you want to delete this announcement bar?")) {
                const formData = new FormData();
                formData.append("_action", "delete");
                fetch(`/app/announcements/${announcementBar.id}`, {
                  method: "POST",
                  body: formData,
                }).then(() => window.location.href = "/app/announcements");
              }
            },
          },
        ]}
      />
      <div className="announcement-editor-layout">
        <div className="editor-form-column">
          <Form method="post">
            <Card>
              <BlockStack gap="500">
                <div style={{ 
                  padding: "12px 16px", 
                  backgroundColor: "#f6f6f7", 
                  borderRadius: "8px",
                  border: "1px solid #e1e3e5"
                }}>
                  <Text as="p" variant="bodyMd" fontWeight="medium">
                    Announcement Bar ID: 
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued" style={{ fontFamily: "monospace", marginTop: "4px" }}>
                    {announcementBar.id}
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued" style={{ marginTop: "4px" }}>
                    Use this ID in the theme app block for custom positioning
                  </Text>
                </div>

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
                  />

                  <TextField
                    label="Subtitle"
                    value={subtitle}
                    onChange={setSubtitle}
                    name="subtitle"
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
                        1. Go to your theme customizer
                      </Text>
                      <Text as="p" variant="bodySm">
                        2. Add the "Announcement Bar" app block where you want it to appear
                      </Text>
                      <Text as="p" variant="bodySm">
                        3. Enter this ID in the block settings: <strong style={{ fontFamily: "monospace" }}>{announcementBar.id}</strong>
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

                {actionData?.success && (
                  <Text as="p" variant="bodyMd" tone="success">
                    Announcement bar updated successfully!
                  </Text>
                )}

                <ButtonGroup>
                  <Button 
                    variant="primary" 
                    loading={isLoading}
                    onClick={() => {
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
                    }}
                  >
                    Save changes
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