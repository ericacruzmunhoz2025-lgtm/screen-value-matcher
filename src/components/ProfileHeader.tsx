import { Globe } from "lucide-react";
import logoPrivacy from "@/assets/logo-privacy.png";

const ProfileHeader = () => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
      <div className="w-8" />
      <img src={logoPrivacy} alt="Privacy" className="h-8" />
      <button className="p-2 rounded-full hover:bg-muted transition-colors">
        <Globe className="w-5 h-5 text-muted-foreground" />
      </button>
    </header>
  );
};

export default ProfileHeader;
