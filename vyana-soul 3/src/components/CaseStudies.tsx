import { ArrowRight } from 'lucide-react';

const projects = [
  {
    id: '01',
    title: 'Akashic Records',
    desc: 'Past Life Readings & Soul Guidance',
    tags: ['Guidance', 'Clarity', 'Karma'],
    color: 'from-purple-900 to-indigo-950',
  },
  {
    id: '02',
    title: 'Lama Fera',
    desc: 'Powerful Energy Healing Technique',
    tags: ['Healing', 'Energy', 'Balance'],
    color: 'from-pink-900/40 to-purple-900/40',
  },
  {
    id: '03',
    title: 'Pranic Healing',
    desc: 'Holistic Wellness & Vitality',
    tags: ['Wellness', 'Prana', 'Vitality'],
    color: 'from-slate-900 to-slate-950',
  }
];

export default function CaseStudies() {
  return (
    <section className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-sm tracking-[0.2em] text-gray-400 uppercase mb-4">OUR OFFERINGS</div>
          <h2 className="text-3xl md:text-4xl font-light">
            Guiding your soul<br />
            through <span className="font-serif italic text-pink-400">meaningful</span> healing.
          </h2>
        </div>
        <a href="/consultancy" className="flex items-center gap-2 text-sm uppercase tracking-wider hover:text-pink-400 transition-colors">
          VIEW ALL SERVICES <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="group relative glass-panel rounded-3xl p-6 transition-transform hover:-translate-y-2 duration-300 flex flex-col h-full">
            {/* Image Placeholder */}
            <div className={`w-full aspect-video rounded-2xl mb-8 bg-gradient-to-br ${project.color} border border-white/5 relative overflow-hidden flex items-center justify-center`}>
               {/* Abstract inner shapes for placeholder */}
               <div className="w-3/4 h-3/4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm" />
            </div>
            
            <div className="mt-auto">
              <div className="text-sm text-gray-400 mb-2">{project.id}</div>
              <h3 className="text-xl font-semibold mb-1">{project.title}</h3>
              <p className="text-gray-400 text-sm mb-6">{project.desc}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {project.tags.map(tag => (
                    <span key={tag} className="text-[10px] uppercase tracking-wider border border-white/10 px-3 py-1 rounded-full text-gray-400 bg-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
                <a href="/consultancy" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
