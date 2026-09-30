import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import type { CommunityPrivacy } from "../types/community";

export async function appendCommunityImage(form: FormData, field: "icon" | "image", asset?: ImagePickerAsset | null) {
  if (!asset) return;
  const type = asset.mimeType || "image/jpeg";
  const name = asset.fileName || `${field}-${Date.now()}.${type.split("/")[1] || "jpg"}`;
  if (Platform.OS === "web") {
    const file = asset.file ?? await (await fetch(asset.uri)).blob();
    form.append(field, file, name);
  } else {
    form.append(field, { uri: asset.uri, type, name } as unknown as Blob);
  }
}

export async function buildCommunityFormData(args: {
  name: string; description: string; categoryId: number | null;
  privacy: CommunityPrivacy; asset: ImagePickerAsset | null;
  update?: boolean; removeIcon?: boolean;
}) {
  const form = new FormData();
  form.append("name", args.name.trim());
  form.append("description", args.description.trim());
  form.append("privacy", args.privacy);
  if (args.categoryId !== null) form.append("categoryId", String(args.categoryId));
  else if (args.update) form.append("removeCategory", "true");
  if (args.update && args.removeIcon && !args.asset) form.append("removeIcon", "true");
  await appendCommunityImage(form, "icon", args.asset);
  return form;
}

export async function buildCommunityPostFormData(body: string, asset: ImagePickerAsset | null) {
  const form = new FormData();
  form.append("body", body.trim());
  await appendCommunityImage(form, "image", asset);
  return form;
}
