import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Psalm {
  text: string;
  reference: string;
}

export default function DailyVerse() {
  const [verse, setVerse] = useState<Psalm | null>(null);

  useEffect(() => {
    const fetchRandomPsalm = async () => {
      // Get total count first, then pick a random offset
      const { count } = await supabase
        .from("psalms")
        .select("*", { count: "exact", head: true });

      if (!count || count === 0) return;

      const randomOffset = Math.floor(Math.random() * count);

      const { data } = await supabase
        .from("psalms")
        .select("text, reference")
        .range(randomOffset, randomOffset)
        .single();

      if (data) {
        setVerse({ text: data.text, reference: data.reference });
      }
    };

    fetchRandomPsalm();
  }, []);

  if (!verse) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm">
      <div className="relative px-5 py-4">
        <div className="absolute top-1 left-3 text-gray-100 text-4xl font-serif leading-none select-none">"</div>

        <div className="pl-5">
          <p className="text-sm text-gray-700 leading-relaxed font-medium" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            {verse.text}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-px flex-1 max-w-[30px] bg-gradient-to-r from-gray-300 to-transparent" />
            <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase">{verse.reference}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
