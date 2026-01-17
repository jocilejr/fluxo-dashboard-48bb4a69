import { useState } from "react";
import { useQuickResponses } from "@/hooks/useQuickResponses";
import { QuickResponsesSidebar } from "@/components/quick-responses/QuickResponsesSidebar";
import { QuickResponsesList } from "@/components/quick-responses/QuickResponsesList";

const Projetos = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { responses, categories, createResponse, updateResponse, deleteResponse } = useQuickResponses();

  const handleCreateCategory = (name: string) => {
    // Category is created automatically when first response with that category is added
    setSelectedCategory(name);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)] overflow-hidden">
      <QuickResponsesSidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onCreateCategory={handleCreateCategory}
      />
      
      <QuickResponsesList
        responses={responses}
        categories={categories}
        selectedCategory={selectedCategory}
        onCreate={(data) => createResponse.mutate(data)}
        onUpdate={(id, data) => updateResponse.mutate({ id, ...data })}
        onDelete={(id) => deleteResponse.mutate(id)}
      />
    </div>
  );
};

export default Projetos;
