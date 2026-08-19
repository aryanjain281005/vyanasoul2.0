import { Mail, MapPin, ArrowRight } from 'lucide-react';

export default function Contact() {
  return (
    <section className="glass-panel rounded-[2.5rem] p-4 md:p-8 flex flex-col lg:flex-row gap-8 overflow-hidden">
      
      {/* Left side Image/Graphic Placeholder */}
      <div className="w-full lg:w-1/3 rounded-3xl bg-gradient-to-t from-purple-900/50 to-pink-900/20 border border-white/5 relative min-h-[300px] flex overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#090314] to-transparent z-10" />
        {/* Decorative elements to replace image */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-pink-500/20 blur-2xl" />
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full bg-purple-500/30 blur-xl" />
        
        {/* Vertical Text */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[10px] tracking-[0.3em] text-gray-400 uppercase whitespace-nowrap z-20">
          BEGIN YOUR JOURNEY
        </div>
      </div>

      {/* Middle & Right Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-12 py-8 px-4">
        
        {/* Info */}
        <div className="flex-1 space-y-8">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-pink-400 uppercase mb-4">READY FOR GUIDANCE?</div>
            <h2 className="text-3xl md:text-4xl font-light mb-6">
              Start your journey toward<br />
              <span className="font-serif italic text-pink-400">healing</span> and clarity.
            </h2>
          </div>
          
          <div className="space-y-4">
            <a href="mailto:info@vyanasoul.com" className="flex items-center gap-4 text-gray-300 hover:text-white transition-colors">
              <Mail className="w-5 h-5 text-gray-500" />
              info@vyanasoul.com
            </a>
            <div className="flex items-center gap-4 text-gray-300">
              <MapPin className="w-5 h-5 text-gray-500" />
              Online Sessions Available Worldwide
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="flex-1 space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-6">
            <input 
              type="text" 
              placeholder="Your Name" 
              className="bg-transparent border-b border-white/20 pb-2 text-sm text-white focus:outline-none focus:border-pink-400 transition-colors placeholder:text-gray-600"
            />
            <input 
              type="email" 
              placeholder="Your Email" 
              className="bg-transparent border-b border-white/20 pb-2 text-sm text-white focus:outline-none focus:border-pink-400 transition-colors placeholder:text-gray-600"
            />
          </div>
          <textarea 
            placeholder="Tell me what you are seeking guidance on..." 
            rows={4}
            className="w-full bg-transparent border-b border-white/20 pb-2 text-sm text-white focus:outline-none focus:border-pink-400 transition-colors placeholder:text-gray-600 resize-none mt-6"
          />
          <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-8 py-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-colors mt-8">
            REQUEST CONSULTATION <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </section>
  );
}
