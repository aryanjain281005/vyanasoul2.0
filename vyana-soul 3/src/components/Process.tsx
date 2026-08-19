import { Heart, Target, Lightbulb, Sparkles, CheckCircle } from 'lucide-react';

const steps = [
  { id: '01', title: 'BOOK', desc: 'Schedule your session and prepare your mind.', icon: CheckCircle },
  { id: '02', title: 'CONNECT', desc: 'Establish an energetic connection and set intentions.', icon: Heart },
  { id: '03', title: 'READING', desc: 'Access your Akashic Records for deep soul insights.', icon: Target },
  { id: '04', title: 'HEALING', desc: 'Clear karmic blockages and restore energetic balance.', icon: Sparkles },
  { id: '05', title: 'INTEGRATE', desc: 'Absorb the guidance and apply it to your daily life.', icon: Lightbulb },
];

export default function Process() {
  return (
    <section className="space-y-16">
      <div>
        <div className="text-sm tracking-[0.2em] text-gray-400 uppercase mb-4">THE HEALING JOURNEY</div>
        <h2 className="text-3xl md:text-4xl font-light">
          A soul-centered approach<br />to personal transformation.
        </h2>
      </div>

      <div className="relative pt-12">
        {/* Connecting Line */}
        <div className="absolute top-20 left-0 w-full h-[1px] bg-white/10 hidden md:block z-0" />
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {steps.map((step) => (
            <div key={step.id} className="relative z-10 flex flex-col">
              <div className="w-16 h-16 rounded-2xl border border-pink-500/30 bg-[#090314] flex items-center justify-center mb-8 mx-auto md:mx-0 shadow-[0_0_15px_rgba(244,114,182,0.1)]">
                <step.icon className="w-6 h-6 text-pink-400" />
              </div>
              
              <div className="flex gap-4 items-baseline mb-2 text-center md:text-left">
                <span className="text-pink-400 font-medium">{step.id}</span>
                <h3 className="text-sm font-semibold tracking-wider">{step.title}</h3>
              </div>
              
              <p className="text-gray-400 text-sm leading-relaxed text-center md:text-left">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
