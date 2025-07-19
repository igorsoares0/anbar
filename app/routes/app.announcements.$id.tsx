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
  InlineStack,
  Icon,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { ClipboardIcon } from "@shopify/polaris-icons";
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
    // Prepare the data object
    const updateData: any = {
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
    };

    // Add buttonText only if it's provided (for migration compatibility)
    const buttonTextValue = formData.get("buttonText") as string;
    if (buttonTextValue) {
      updateData.buttonText = buttonTextValue;
    }

    await prisma.announcementBar.update({
      where: { id, shop: session.shop },
      data: updateData,
    });

    // Automatically sync after update
    const syncResult = await syncAnnouncementBarsToMetafields(session, admin);
    if (!syncResult.success) {
      console.warn("Failed to sync announcement bars after update:", syncResult.error);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Update error:", error);
    return json({ error: `Failed to update announcement bar: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 400 });
  }
};

export default function EditAnnouncementBar() {
  const { announcementBar } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  // Helper function to convert hex to HSVA
  const convertHexToHsva = (hex: string) => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    // Calculate brightness (value)
    const v = max;

    // Calculate saturation
    const s = max === 0 ? 0 : diff / max;

    // Calculate hue
    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
    }
    h = h * 60;
    if (h < 0) h += 360;

    return { hue: h, saturation: s, brightness: v, alpha: 1 };
  };

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
  const [backgroundColor, setBackgroundColor] = useState(convertHexToHsva(announcementBar.backgroundColor));
  const [backgroundColorHex, setBackgroundColorHex] = useState(announcementBar.backgroundColor);
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false);
  const [borderRadius, setBorderRadius] = useState(announcementBar.borderRadius);
  const [borderWidth, setBorderWidth] = useState(announcementBar.borderWidth);
  const [borderColor, setBorderColor] = useState(convertHexToHsva(announcementBar.borderColor));
  const [borderColorHex, setBorderColorHex] = useState(announcementBar.borderColor);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [fontFamily, setFontFamily] = useState(announcementBar.fontFamily);
  const [titleSize, setTitleSize] = useState(announcementBar.titleSize);
  const [titleColor, setTitleColor] = useState(convertHexToHsva(announcementBar.titleColor));
  const [titleColorHex, setTitleColorHex] = useState(announcementBar.titleColor);
  const [showTitleColorPicker, setShowTitleColorPicker] = useState(false);
  const [subtitleSize, setSubtitleSize] = useState(announcementBar.subtitleSize);
  const [subtitleColor, setSubtitleColor] = useState(convertHexToHsva(announcementBar.subtitleColor));
  const [subtitleColorHex, setSubtitleColorHex] = useState(announcementBar.subtitleColor);
  const [showSubtitleColorPicker, setShowSubtitleColorPicker] = useState(false);
  const [discountCodeColor, setDiscountCodeColor] = useState(convertHexToHsva(announcementBar.discountCodeColor));
  const [discountCodeColorHex, setDiscountCodeColorHex] = useState(announcementBar.discountCodeColor);
  const [showDiscountCodeColorPicker, setShowDiscountCodeColorPicker] = useState(false);
  const [buttonText, setButtonText] = useState(announcementBar.buttonText || "Shop Now");
  const [buttonColor, setButtonColor] = useState(convertHexToHsva(announcementBar.buttonColor));
  const [buttonColorHex, setButtonColorHex] = useState(announcementBar.buttonColor);
  const [showButtonColorPicker, setShowButtonColorPicker] = useState(false);
  const [buttonTextSize, setButtonTextSize] = useState(announcementBar.buttonTextSize);
  const [buttonTextColor, setButtonTextColor] = useState(convertHexToHsva(announcementBar.buttonTextColor));
  const [buttonTextColorHex, setButtonTextColorHex] = useState(announcementBar.buttonTextColor);
  const [showButtonTextColorPicker, setShowButtonTextColorPicker] = useState(false);
  const [buttonBorderRadius, setButtonBorderRadius] = useState(announcementBar.buttonBorderRadius);
  const [displayLocation, setDisplayLocation] = useState(announcementBar.displayLocation);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [isPublished, setIsPublished] = useState(announcementBar.isPublished);

  // Sync hex values when colors change
  useEffect(() => {
    setBackgroundColorHex(convertHsvaToHex(backgroundColor));
  }, [backgroundColor]);

  useEffect(() => {
    setBorderColorHex(convertHsvaToHex(borderColor));
  }, [borderColor]);

  useEffect(() => {
    setTitleColorHex(convertHsvaToHex(titleColor));
  }, [titleColor]);

  useEffect(() => {
    setSubtitleColorHex(convertHsvaToHex(subtitleColor));
  }, [subtitleColor]);

  useEffect(() => {
    setDiscountCodeColorHex(convertHsvaToHex(discountCodeColor));
  }, [discountCodeColor]);

  useEffect(() => {
    setButtonColorHex(convertHsvaToHex(buttonColor));
  }, [buttonColor]);

  useEffect(() => {
    setButtonTextColorHex(convertHsvaToHex(buttonTextColor));
  }, [buttonTextColor]);

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
            grid-template-columns: 1fr 1.5fr !important;
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
                  padding: "16px", 
                  backgroundColor: "#f6f6f7", 
                  borderRadius: "8px",
                  border: "1px solid #e1e3e5"
                }}>
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Announcement Bar ID
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Use this ID in the theme app block for custom positioning
                      </Text>
                    </BlockStack>
                    <Tooltip content="Copy ID to clipboard">
                      <Button
                        variant="tertiary"
                        size="micro"
                        icon={ClipboardIcon}
                        onClick={() => {
                          navigator.clipboard.writeText(announcementBar.id).then(() => {
                            shopify.toast.show('ID copied to clipboard!');
                          }).catch(() => {
                            shopify.toast.show('Failed to copy ID', { isError: true });
                          });
                        }}
                        accessibilityLabel="Copy announcement bar ID"
                      />
                    </Tooltip>
                  </InlineStack>
                  <Box paddingBlockStart="300">
                    <div style={{
                      padding: "8px 12px",
                      backgroundColor: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      color: "#374151",
                      wordBreak: "break-all",
                      userSelect: "all"
                    }}>
                      {announcementBar.id}
                    </div>
                  </Box>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "36px",
                          backgroundColor: convertHsvaToHex(backgroundColor),
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
                      />
                      <TextField
                        value={backgroundColorHex}
                        onChange={(value) => {
                          setBackgroundColorHex(value);
                          if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                            setBackgroundColor(convertHexToHsva(value));
                          }
                        }}
                        placeholder="#8340aa"
                        connectedLeft
                      />
                    </div>
                    {showBackgroundColorPicker && (
                      <Box paddingBlockStart="300">
                        <ColorPicker
                          color={backgroundColor}
                          onChange={(color) => {
                            setBackgroundColor(color);
                          }}
                        />
                      </Box>
                    )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "36px",
                          backgroundColor: convertHsvaToHex(borderColor),
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                      />
                      <TextField
                        value={borderColorHex}
                        onChange={(value) => {
                          setBorderColorHex(value);
                          if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                            setBorderColor(convertHexToHsva(value));
                          }
                        }}
                        placeholder="#8340aa"
                        connectedLeft
                      />
                    </div>
                    {showBorderColorPicker && (
                      <Box paddingBlockStart="300">
                        <ColorPicker
                          color={borderColor}
                          onChange={(color) => {
                            setBorderColor(color);
                          }}
                        />
                      </Box>
                    )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "36px",
                          backgroundColor: convertHsvaToHex(titleColor),
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowTitleColorPicker(!showTitleColorPicker)}
                      />
                      <TextField
                        value={titleColorHex}
                        onChange={(value) => {
                          setTitleColorHex(value);
                          if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                            setTitleColor(convertHexToHsva(value));
                          }
                        }}
                        placeholder="#8340aa"
                        connectedLeft
                      />
                    </div>
                    {showTitleColorPicker && (
                      <Box paddingBlockStart="300">
                        <ColorPicker
                          color={titleColor}
                          onChange={(color) => {
                            setTitleColor(color);
                          }}
                        />
                      </Box>
                    )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "36px",
                          backgroundColor: convertHsvaToHex(subtitleColor),
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowSubtitleColorPicker(!showSubtitleColorPicker)}
                      />
                      <TextField
                        value={subtitleColorHex}
                        onChange={(value) => {
                          setSubtitleColorHex(value);
                          if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                            setSubtitleColor(convertHexToHsva(value));
                          }
                        }}
                        placeholder="#8340aa"
                        connectedLeft
                      />
                    </div>
                    {showSubtitleColorPicker && (
                      <Box paddingBlockStart="300">
                        <ColorPicker
                          color={subtitleColor}
                          onChange={(color) => {
                            setSubtitleColor(color);
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <Text as="p" variant="bodyMd">
                      Discount code color
                    </Text>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "36px",
                          backgroundColor: convertHsvaToHex(discountCodeColor),
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setShowDiscountCodeColorPicker(!showDiscountCodeColorPicker)}
                      />
                      <TextField
                        value={discountCodeColorHex}
                        onChange={(value) => {
                          setDiscountCodeColorHex(value);
                          if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                            setDiscountCodeColor(convertHexToHsva(value));
                          }
                        }}
                        placeholder="#8340aa"
                        connectedLeft
                      />
                    </div>
                    {showDiscountCodeColorPicker && (
                      <Box paddingBlockStart="300">
                        <ColorPicker
                          color={discountCodeColor}
                          onChange={(color) => {
                            setDiscountCodeColor(color);
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  {callToAction === "button" && (
                    <>
                      <TextField
                        label="Button text"
                        value={buttonText}
                        onChange={setButtonText}
                        name="buttonText"
                        placeholder="Shop Now"
                      />

                      <Box>
                        <Text as="p" variant="bodyMd">
                          Button color
                        </Text>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "36px",
                              backgroundColor: convertHsvaToHex(buttonColor),
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                            onClick={() => setShowButtonColorPicker(!showButtonColorPicker)}
                          />
                          <TextField
                            value={buttonColorHex}
                            onChange={(value) => {
                              setButtonColorHex(value);
                              if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                setButtonColor(convertHexToHsva(value));
                              }
                            }}
                            placeholder="#8340aa"
                            connectedLeft
                          />
                        </div>
                        {showButtonColorPicker && (
                          <Box paddingBlockStart="300">
                            <ColorPicker
                              color={buttonColor}
                              onChange={(color) => {
                                setButtonColor(color);
                              }}
                            />
                          </Box>
                        )}
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
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "36px",
                              backgroundColor: convertHsvaToHex(buttonTextColor),
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                            onClick={() => setShowButtonTextColorPicker(!showButtonTextColorPicker)}
                          />
                          <TextField
                            value={buttonTextColorHex}
                            onChange={(value) => {
                              setButtonTextColorHex(value);
                              if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                setButtonTextColor(convertHexToHsva(value));
                              }
                            }}
                            placeholder="#8340aa"
                            connectedLeft
                          />
                        </div>
                        {showButtonTextColorPicker && (
                          <Box paddingBlockStart="300">
                            <ColorPicker
                              color={buttonTextColor}
                              onChange={(color) => {
                                setButtonTextColor(color);
                              }}
                            />
                          </Box>
                        )}
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
                      formData.append("buttonText", buttonText);
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
                  <Button 
                    variant="primary"
                    tone="critical"
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Are you sure you want to delete "${announcementBar.name}"? This action cannot be undone.`)) {
                        const formData = new FormData();
                        formData.append("_action", "delete");
                        submit(formData, { method: "post" });
                      }
                    }}
                  >
                    Delete
                  </Button>
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
                    style={{ 
                      display: "flex", 
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      flex: 1
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      flexDirection: announcementType === "continuous" ? "row" : "column", 
                      alignItems: announcementType === "continuous" ? "center" : "flex-start", 
                      gap: announcementType === "continuous" ? "8px" : "4px" 
                    }}>
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
                    </div>
                    {discountCode && (
                      <div
                        onClick={() => {
                          navigator.clipboard.writeText(discountCode).then(() => {
                            alert('Discount code copied to clipboard!');
                          }).catch(() => {
                            alert('Failed to copy discount code');
                          });
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: `2px dashed ${convertHsvaToHex(discountCodeColor)}`,
                          borderRadius: "6px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          color: convertHsvaToHex(discountCodeColor),
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <span
                          style={{
                            fontSize: `${titleSize}px`,
                            fontWeight: "bold",
                            userSelect: "none",
                          }}
                        >
                          {discountCode}
                        </span>
                      </div>
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
                        {buttonText}
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