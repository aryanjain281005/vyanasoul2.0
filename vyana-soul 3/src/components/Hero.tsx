import { ArrowRight, Heart, User } from 'lucide-react';

export default function Hero() {
  return (
    <section className="pt-12 lg:pt-24 flex flex-col lg:flex-row items-center justify-between gap-16 relative">
      {/* Left Content */}
      <div className="flex-1 space-y-8 z-10">
        <div className="text-sm tracking-[0.2em] text-gray-400">| AKASHIC RECORDS & HEALING |</div>
        
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-light leading-tight">
          Unlock the wisdom of<br />
          your soul for profound <span className="font-serif italic text-pink-400 font-medium">healing.</span>
        </h1>
        
        <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
          I help you navigate your life's journey through Akashic Records reading, Pranic Healing, and Lama Fera—bringing clarity, purpose, and energetic balance.
        </p>
        
        <div className="flex flex-wrap items-center gap-4 pt-4">
          <a href="/consultancy" className="flex items-center gap-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white px-8 py-3.5 rounded-full font-medium hover:opacity-90 transition-opacity">
            BOOK A SESSION <ArrowRight className="w-4 h-4" />
          </a>
          <a href="/about" className="flex items-center gap-2 border border-white/20 px-8 py-3.5 rounded-full font-medium hover:bg-white/5 transition-colors">
            ABOUT REKHA <User className="w-4 h-4" />
          </a>
        </div>

        <div className="pt-8 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-pink-400 animate-pulse" />
          <div className="text-sm text-gray-400">
            <span className="text-white">AVAILABLE FOR CONSULTATIONS</span><br />
            Let's discover your path.
          </div>
        </div>
      </div>

      {/* Right Content - Abstract visualization replacing background image */}
      <div className="flex-1 relative w-full aspect-square max-w-lg lg:max-w-none">
        {/* Placeholder for the main hero image (circle) */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute inset-4 rounded-full border border-white/10 bg-gradient-to-t from-purple-900/30 to-transparent flex items-center justify-center overflow-hidden">
             {/* Inner glowing circle */}
             <div className="w-3/4 h-3/4 rounded-full border border-pink-500/30 shadow-[0_0_100px_rgba(244,114,182,0.2)]" />
        </div>

        {/* Floating Cards */}
        <div className="absolute top-12 right-0 glass-panel p-5 rounded-2xl w-48 shadow-2xl z-20">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">GUIDANCE</div>
          <div className="text-sm font-medium">with deep<br />empathy.</div>
          <Heart className="w-4 h-4 text-pink-400 mt-3 ml-auto" fill="currentColor" />
        </div>

        <div className="absolute bottom-32 -left-12 glass-panel p-5 rounded-2xl w-48 shadow-2xl z-20">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">FOUNDER</div>
          <div className="text-xl font-semibold mb-1">REKHA BALA</div>
          <div className="text-sm text-gray-400">Spiritual Healer &<br />Guide</div>
        </div>

        <div className="absolute bottom-12 right-12 glass-panel p-5 rounded-2xl w-56 shadow-2xl z-20">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-4">OFFERINGS</div>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> Akashic Records</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> Lama Fera Healing</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> Pranic Healing</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> Spiritual Courses</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
