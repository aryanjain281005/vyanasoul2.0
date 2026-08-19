import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CaseStudies from './components/CaseStudies';
import Services from './components/Services';
import Process from './components/Process';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-[#090314] text-white selection:bg-pink-500/30">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-24">
        <Navbar />
        <main className="flex flex-col gap-32 pb-32">
          <Hero />
          <CaseStudies />
          <Services />
          <Process />
          <Testimonials />
          <Contact />
        </main>
        <Footer />
      </div>
    </div>
  );
}
