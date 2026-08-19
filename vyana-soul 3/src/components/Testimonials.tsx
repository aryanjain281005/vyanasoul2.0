import { ArrowRight, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "The Akashic Records reading brought so much clarity to my life path. Rekha's deep insight helped me understand my recurring patterns and release them.",
    author: "CLIENT REVIEW",
    role: "Akashic Records Reading",
    avatar: "bg-blue-900"
  },
  {
    quote: "My Pranic Healing sessions have been truly transformative. I feel lighter, more grounded, and completely aligned with my true self.",
    author: "CLIENT REVIEW",
    role: "Pranic Healing",
    avatar: "bg-purple-900"
  },
  {
    quote: "Rekha is a gifted soul guide. Her empathy and intuition create a safe space for deep healing and spiritual awakening.",
    author: "CLIENT REVIEW",
    role: "Spiritual Guidance",
    avatar: "bg-emerald-900"
  }
];

export default function Testimonials() {
  return (
    <section className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-sm tracking-[0.2em] text-gray-400 uppercase mb-4">CLIENT REVIEWS</div>
          <h2 className="text-3xl md:text-4xl font-light">
            Transformative experiences shared<br />by beautiful souls.
          </h2>
        </div>
        <a href="/reviews" className="flex items-center gap-2 text-sm uppercase tracking-wider hover:text-pink-400 transition-colors">
          VIEW ALL REVIEWS <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, i) => (
          <div key={i} className="glass-panel rounded-3xl p-8 flex flex-col relative">
            <Quote className="w-8 h-8 text-pink-500/20 absolute top-8 left-8" />
            <p className="text-gray-300 leading-relaxed text-sm mb-10 mt-6 relative z-10">
              "{testimonial.quote}"
            </p>
            
            <div className="flex items-center gap-4 mt-auto">
              <div className={`w-12 h-12 rounded-full ${testimonial.avatar} border border-white/10`} />
              <div>
                <div className="text-xs font-semibold tracking-wider">{testimonial.author}</div>
                <div className="text-[10px] text-gray-500 uppercase mt-1">{testimonial.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
