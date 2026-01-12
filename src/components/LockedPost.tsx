import { Lock, Heart, MessageCircle, DollarSign, Bookmark, MoreVertical, Image, Film } from "lucide-react";
import profileImage from "@/assets/profile.jpg";
import lockedPreview from "@/assets/locked-preview.png";

const LockedPost = () => {
  return (
    <div className="content-card mx-4">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
            <img
              src={profileImage}
              alt="Foto de perfil da Lais Nascimento"
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Lais Nascimento</h4>
            <p className="text-sm text-muted-foreground">@Alaisnacimento</p>
          </div>
        </div>
        <button className="p-2 rounded-full hover:bg-muted transition-colors">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Locked Content */}
      <div className="relative h-64 overflow-hidden flex flex-col items-center justify-center">
        {/* Blurred background image */}
        <img
          src={lockedPreview}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110"
          loading="lazy"
          decoding="async"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Content overlay */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <Lock className="w-12 h-12 text-white/70 mb-4" />
          
          <div className="flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <Image className="w-4 h-4" />
              250
            </span>
            <span className="flex items-center gap-1">
              <Film className="w-4 h-4" />
              189
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              16.6K
            </span>
          </div>
        </div>
      </div>

      {/* Post Actions */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <Heart className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <button className="p-2 rounded-full hover:bg-muted transition-colors">
          <Bookmark className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default LockedPost;
