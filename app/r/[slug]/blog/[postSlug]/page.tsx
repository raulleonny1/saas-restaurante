"use client";

import { BlogPostPage } from "@/modules/website/components/public/PublicPages";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ postSlug: string }>;
}) {
  const { postSlug } = use(params);
  return <BlogPostPage postSlug={postSlug} />;
}
