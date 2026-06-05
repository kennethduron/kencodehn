"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type ChatResponse = {
  ok?: boolean;
  answer?: string;
  message?: string;
};

const initialMessage =
  "¡Hola! Soy KenCode AI. Puedo ayudarte a conocer nuestros servicios, proyectos y soluciones digitales. ¿En qué puedo ayudarte hoy?";

const fallbackMessage =
  "No tengo esa información disponible actualmente. Puede contactar directamente a KenCode para obtener información más específica.";

const quickPrompts = [
  { label: "Servicios", message: "Qué servicios ofrece Ken Code?" },
  { label: "Cotización", message: "Cómo puedo solicitar una cotización?" },
  { label: "Proyectos", message: "Qué proyectos ha realizado Ken Code?" },
];

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

export function KenCodeAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([createMessage("assistant", initialMessage)]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, isOpen]);

  async function sendMessage(message: string) {
    const cleanMessage = message.trim();
    if (!cleanMessage || isLoading) return;

    setInput("");
    setError("");
    setIsLoading(true);
    setMessages((current) => [...current, createMessage("user", cleanMessage)]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: cleanMessage }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok || !data.answer) {
        throw new Error(data.message || "No fue posible responder en este momento.");
      }

      setMessages((current) => [...current, createMessage("assistant", data.answer || fallbackMessage)]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No fue posible conectar con KenCode AI.";
      setError(message);
      setMessages((current) => [...current, createMessage("assistant", fallbackMessage)]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className={`fixed bottom-5 left-5 sm:bottom-6 sm:left-6 ${isOpen ? "z-50" : "z-40"}`}>
      {isOpen ? (
        <section
          aria-label="KenCode AI chat"
          className="flex h-[min(620px,calc(100svh-2rem))] w-[calc(100vw-2.5rem)] max-w-[24rem] flex-col overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-bg-soft/96 shadow-[0_22px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:w-[24rem]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan">
                <Bot size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-black text-kc-text">KenCode AI</h2>
                <p className="truncate text-xs font-semibold text-kc-muted">Asistente público de Ken Code</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar KenCode AI"
              title="Cerrar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-kc-muted transition hover:border-kc-cyan/45 hover:text-kc-cyan"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "rounded-br-md bg-kc-electric text-white shadow-[0_0_26px_rgba(0,109,255,0.22)]"
                        : "rounded-bl-md border border-white/10 bg-white/[0.05] text-kc-text"
                    }`}
                  >
                    {message.content}
                  </p>
                </div>
              ))}

              {isLoading ? (
                <div className="flex justify-start">
                  <p className="inline-flex max-w-[88%] items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-kc-muted">
                    <Loader2 className="animate-spin text-kc-cyan" size={16} aria-hidden="true" />
                    Pensando...
                  </p>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-kc-bg/72 px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void sendMessage(prompt.message)}
                  className="min-h-9 rounded-lg border border-kc-border bg-white/[0.04] px-3 text-xs font-black text-kc-text transition hover:border-kc-cyan/45 hover:text-kc-cyan disabled:opacity-55"
                >
                  {prompt.label}
                </button>
              ))}
              <a
                href="https://wa.me/50499112211"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-kc-turquoise/35 bg-kc-turquoise/10 px-3 text-xs font-black text-kc-turquoise transition hover:border-kc-lime/55 hover:text-kc-lime"
              >
                WhatsApp
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>

            {error ? <p className="mb-2 text-xs font-semibold leading-5 text-red-200">{error}</p> : null}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="kencode-ai-message">
                Escribe tu pregunta
              </label>
              <textarea
                id="kencode-ai-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={1}
                placeholder="Escribe tu pregunta..."
                className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-kc-border bg-kc-bg/80 px-3 py-2.5 text-sm leading-6 text-kc-text placeholder:text-kc-muted/70 focus:border-kc-cyan"
              />
              <button
                type="submit"
                disabled={isLoading || input.trim().length === 0}
                aria-label="Enviar mensaje"
                title="Enviar"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-kc-electric text-white shadow-[0_0_24px_rgba(0,109,255,0.28)] transition hover:bg-kc-cyan hover:text-kc-bg disabled:opacity-55"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir KenCode AI"
          title="KenCode AI"
          className="group relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-kc-cyan/45 bg-kc-bg-soft text-kc-cyan shadow-[0_0_34px_rgba(0,217,255,0.24)] transition hover:-translate-y-0.5 hover:border-kc-turquoise hover:text-kc-turquoise hover:shadow-[0_0_44px_rgba(0,230,168,0.24)]"
        >
          <span className="absolute -top-11 left-0 hidden whitespace-nowrap rounded-lg border border-white/10 bg-kc-bg-soft px-3 py-2 text-xs font-black text-kc-text shadow-xl group-hover:block">
            KenCode AI
          </span>
          <MessageCircle size={25} aria-hidden="true" />
          <Sparkles className="absolute right-2 top-2 text-kc-lime" size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
