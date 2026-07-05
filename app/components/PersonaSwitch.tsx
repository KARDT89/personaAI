"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PersonaOption = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  tagline?: string | null;
  bio?: string | null;
  topics?: string[];
  starterPrompts?: string[];
  isBuiltIn?: boolean;
};

type PersonaSwitchProps = {
  disabled?: boolean;
  personas: PersonaOption[];
  value: string;
  onValueChange: (personaId: string) => void;
};

export function PersonaSwitch({
  disabled,
  personas,
  value,
  onValueChange,
}: PersonaSwitchProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => {
        onValueChange(nextValue);
      }}
    >
      <TabsList className="w-full sm:w-fit">
        {personas.map((persona) => (
          <TabsTrigger
            key={persona.id}
            value={persona.id}
            disabled={disabled}
            className="min-w-24"
          >
            {persona.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
