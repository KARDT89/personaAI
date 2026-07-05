"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PersonaOption = {
  id: "hitesh" | "piyush";
  name: string;
};

type PersonaSwitchProps = {
  disabled?: boolean;
  personas: PersonaOption[];
  value: PersonaOption["id"];
  onValueChange: (personaId: PersonaOption["id"]) => void;
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
        if (isPersonaId(nextValue)) {
          onValueChange(nextValue);
        }
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

function isPersonaId(value: string): value is PersonaOption["id"] {
  return value === "hitesh" || value === "piyush";
}
