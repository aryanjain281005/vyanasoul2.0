import { ArrowRight, Dribbble, Instagram, Linkedin, Twitter } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between py-8">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border border-pink-400 flex items-center justify-center">
          <div className="w-5 h-5 border-t-2 border-l-2 border-pink-400 rounded-tl-full" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-semibold tracking-wider leading-none">VYANA SOUL</span>
          <span className="text-[10px] text-gray-400 tracking-[0.2em] mt-1">SOUL GUIDANCE</span>
        </div>
      </div>

      {/* Links */}
      <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
        <a href="/" className="flex flex-col items-center gap-1 text-white">
          <span>Home</span>
          <div className="w-1 h-1 bg-pink-400 rounded-full" />
        </a>
        <a href="/about" className="hover:text-white transition-colors">About</a>
        <a href="/consultancy" className="hover:text-white transition-colors">Consultancy</a>
        <a href="/courses" className="hover:text-white transition-colors">Courses</a>
        <a href="/gallery" className="hover:text-white transition-colors">Gallery</a>
        <a href="/reviews" className="hover:text-white transition-colors">Reviews</a>
        <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
        <a href="/blog" className="hover:text-white transition-colors">Blog</a>
      </div>

      {/* CTA */}
      <a href="/contact" className="hidden md:block px-6 py-2.5 rounded-full border border-white/20 text-sm hover:bg-white/10 transition-colors">
        Book a Consultation
      </a>
    </nav>
  );
}
