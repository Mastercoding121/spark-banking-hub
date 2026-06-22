import React from "react";
import { Loader2 } from "lucide-react";

interface EnhancedLoadingScreenProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export const EnhancedLoadingScreen: React.FC<EnhancedLoadingScreenProps> = ({
  title,
  subtitle,
  className = "",
}) => {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${className}`}>
      {/* Ambient glows */}
      <div className="absolute top-20 left-1/4 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-1/4 h-80 w-80 rounded-full bg-red-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      
      {/* Particle system (simple CSS particles) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-amber-400/30"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 10 + 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: Math.random() * 0.5 + 0.2,
            }}
          />
        ))}
      </div>
      
      {/* Content container */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-8">
        {/* Spinning icon with glow */}
        <div className="relative mb-8">
          <div className="absolute -inset-4 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <Loader2 className="h-20 w-20 animate-spin text-amber-400" />
        </div>
        
        {/* Text content */}
        <h1 className="mb-4 text-3xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-lg text-slate-300">{subtitle}</p>
        )}
      </div>
      
      {/* Custom keyframes for floating particles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.5; }
          50% { transform: translateY(-40px) translateX(-5px); opacity: 0.3; }
          75% { transform: translateY(-20px) translateX(-15px); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
