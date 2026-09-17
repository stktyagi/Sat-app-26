// sat-app/app/src/api/faq.ts
import { FAQ } from "@/types/models";
import { apiFetch, readError } from "./client";

interface ListFaqsResponse {
  items: Array<{
      id: string;
      question: string;
      answer: string;
      order: number;

  }>;

}

/**
 * Fetches public FAQs from the Go backend: GET /api/v1/faq
 */
export async function listPublicFAQs(): Promise<FAQ[]> {
  const response = await apiFetch("/faqs", {}, "none");
  if (!response.ok) {
    const errorMsg = await readError(response, "Could not load FAQs");
    throw new Error(errorMsg);
  }

  const body = (await response.json()) as ListFaqsResponse;
  return (body.items || []).map((item, index) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    order: item.order ?? index + 1,
  }));
}
