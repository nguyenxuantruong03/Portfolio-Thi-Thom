"use client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useLang } from "@/lib/i18n";

type FormValues = { name: string; email: string; message: string };

export function ContactForm() {
  const { t } = useLang();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("form.errName")),
        email: z.string().email(t("form.errEmail")),
        message: z.string().min(10, t("form.errMessage")),
      }),
    [t],
  );
  const [status, setStatus] = useState<string>("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = async (values: FormValues) => {
    setStatus("");
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message ?? t("form.fail"));
      return;
    }
    reset();
    setStatus(t("form.ok"));
  };
  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4">
      <div>
        <Input placeholder={t("form.name")} {...register("name")} />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Input type="email" placeholder={t("form.email")} {...register("email")} />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>
      <div>
        <Textarea
          placeholder={t("form.message")}
          {...register("message")}
        />
        {errors.message && (
          <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting} size="lg">
        {isSubmitting ? t("form.sending") : t("form.send")} <Send size={16} />
      </Button>
      {status && <p className="text-sm font-medium text-[#3548e6]">{status}</p>}
    </form>
  );
}
