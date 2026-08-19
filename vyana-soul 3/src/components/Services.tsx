import { Compass, Sparkles, BrainCircuit, Book } from 'lucide-react';

const services = [
  {
    icon: Compass,
    title: 'AKASHIC RECORDS',
    desc: 'Access the energetic archive of your soul’s past, present, and future.'
  },
  {
    icon: Sparkles,
    title: 'PRANIC HEALING',
    desc: 'A powerful no-touch energy healing system that utilizes prana to balance the body.'
  },
  {
    icon: BrainCircuit,
    title: 'LAMA FERA',
    desc: 'A highly effective Buddhist healing technique used to release negative energy.'
  },
  {
    icon: Book,
    title: 'SPIRITUAL COURSES',
    desc: 'Empower yourself with comprehensive workshops and structured spiritual programs.'
  }
];

const tools = [
  { name: 'Karma', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { name: 'Relationships', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { name: 'Health', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Finance', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { name: 'Career', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { name: 'Life Purpose', color: 'text-purple-400', bg: 'bg-purple-400/10' },
];

export default function Services() {
  return (
    <section className="flex flex-col lg:flex-row gap-16 lg:gap-8">
      {/* Services Left */}
      <div className="flex-1 space-y-12">
        <div>
          <div className="text-sm tracking-[0.2em] text-gray-400 uppercase mb-4">HEALING MODALITIES</div>
          <h2 className="text-3xl md:text-4xl font-light max-w-md leading-tight">
            Deep spiritual guidance tailored to your soul's journey.
          </h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-12 gap-x-8">
          {services.map((service) => (
            <div key={service.title}>
              <div className="w-12 h-12 rounded-xl border border-pink-500/30 bg-pink-500/5 flex items-center justify-center mb-6">
                <service.icon className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-sm font-semibold tracking-wider mb-3">{service.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{service.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Right */}
      <div className="w-full lg:w-80 glass-panel rounded-3xl p-8 h-fit">
        <h3 className="text-sm tracking-[0.2em] text-gray-400 uppercase mb-8">AREAS OF FOCUS</h3>
        <div className="grid grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div key={tool.name} className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl ${tool.bg} border border-white/5 flex items-center justify-center`}>
                <div className={`w-6 h-6 rounded-md ${tool.color} flex items-center justify-center font-bold text-xs bg-white/5`}>
                   {/* Simplified icon representation */}
                   {tool.name[0]}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 text-center">{tool.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
