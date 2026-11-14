import { redirect } from "next/navigation";

export default function SubscriberEditRedirect() {
  redirect("/admin/newsletter?tab=subscribers");
}
