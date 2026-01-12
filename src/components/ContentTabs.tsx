import { FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";

const ContentTabs = () => {
  const [activeTab, setActiveTab] = useState<"posts" | "media">("posts");

  return (
    <div className="content-card mx-4">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
            activeTab === "posts" ? "tab-active" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          250 Postagens
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
            activeTab === "media" ? "tab-active" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          189 Mídias
        </button>
      </div>
    </div>
  );
};

export default ContentTabs;
