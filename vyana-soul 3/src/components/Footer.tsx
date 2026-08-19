import { Instagram, Linkedin, Twitter, Youtube, Facebook } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="pt-20 pb-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-12">
      
      {/* Brand */}
      <div className="space-y-6 max-w-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-pink-400 flex items-center justify-center">
            <div className="w-4 h-4 border-t-2 border-l-2 border-pink-400 rounded-tl-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-wider leading-none">VYANA SOUL</span>
            <span className="text-[8px] text-gray-400 tracking-[0.2em] mt-1">SOUL GUIDANCE</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Illuminating your path through<br />spiritual wisdom and healing.
        </p>
        <div className="text-[10px] text-gray-600">
          © 2024 Vyana Soul. All rights reserved.
        </div>
      </div>

      {/* Explore */}
      <div>
        <h4 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-6">EXPLORE</h4>
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-xs text-gray-300">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <a href="/about" className="hover:text-white transition-colors">About</a>
          <a href="/consultancy" className="hover:text-white transition-colors">Consultancy</a>
          <a href="/courses" className="hover:text-white transition-colors">Courses</a>
          <a href="/gallery" className="hover:text-white transition-colors">Gallery</a>
          <a href="/reviews" className="hover:text-white transition-colors">Reviews</a>
          <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
          <a href="/contact" className="hover:text-white transition-colors">Contact</a>
          <a href="/blog" className="hover:text-white transition-colors">Blog</a>
        </div>
      </div>

      {/* Connect & Legal */}
      <div className="flex flex-col justify-between">
        <div>
          <h4 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-6">LET'S CONNECT</h4>
          <div className="flex items-center gap-4">
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <Youtube className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-[10px] text-gray-600 mt-12 md:mt-0">
          <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Terms & Conditions</a>
        </div>
      </div>

    </footer>
  );
}
