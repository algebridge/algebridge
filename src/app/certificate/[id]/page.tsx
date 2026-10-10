import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allUnits, getUnit } from "@/data/curriculum";
import { CertificateView } from "@/components/CertificateView";
import { COURSE_ID } from "@/lib/certificates";

export function generateStaticParams() {
  return [...allUnits().map((u) => ({ id: u.id })), { id: COURSE_ID }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (id === COURSE_ID) return { title: "Algebra 1 certificate" };
  const unit = getUnit(id);
  return unit ? { title: `Unit ${unit.number} certificate` } : {};
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== COURSE_ID && !getUnit(id)) notFound();
  return <CertificateView id={id} />;
}
