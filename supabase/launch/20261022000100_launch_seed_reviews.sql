-- Run at launch, when www.vyanasoul.com switches to the v2 site (not before: the v1 site lists
-- every row in public.reviews, so these would appear there too).
-- Needs 20261022000000_v2_foundation.sql. Safe to run more than once.

-- The four reviews the v1 site showed from code, and the v2 frontend hard-coded, now live in the table
insert into public.reviews (name, role, location, rating, review, full_review, service, language, featured, sort_order, created_at)
select v.name, 'Client', v.location, 5, v.review, v.full_review, v.service, v.language, true, v.sort_order, '2026-05-01'::timestamptz
from (values
  ('Mr. Rudra', 'Mumbai', 'Healing and guidance session', 'en', 1,
   'When my father fell critically ill, a friend suggested I connect with Rekhaji for an Akashic reading. I was sceptical but desperate. What I experienced was beyond words: things so accurate, so personal, that I had no explanation. I followed every piece of her guidance with faith. And then something we were all praying for happened. My father survived.',
   'There are some experiences in life that shake you from within and change you forever; this is one of mine. When my father fell seriously ill and was hospitalized, it felt like the ground beneath my feet had disappeared. A friend suggested I connect with Rekhaji for an Akashic reading. Honestly, I didn''t believe in any of it, but my heart was desperate. What I experienced next is something I still struggle to put into words. The depth of what she shared, things so accurate and so personal, gave me goosebumps. With nothing to lose and everything at stake, I followed every piece of guidance she gave me, with faith, even if it was borrowed faith in the beginning. And then something we were all praying for happened. My father survived. Some things in life cannot be explained; they can only be felt.'),
  ('Ms. Soni', 'Lucknow', 'Akashic reading', 'hinglish', 2,
   'Ye mera first session tha aapke saath aur main bilkul satisfied hoon. Aapne har cheez ko bahut clarity aur patience ke saath samjhaya. Session ke baad mujhe bahut sukoon feel ho raha hai.',
   'Aaj ki reading ke liye bahut bahut shukriya. Ye mera first session tha aapke saath aur main session se bilkul satisfied hoon. It was a wonderful experience for me. Aapne har cheez ko bahut clarity aur patience ke saath samjhaya. Aapne meri situation ko deeply samjha aur bina jaldbazi ke har sawaal ka jawaab diya. Aapki vibrations bahut positive hain. Session ke baad mujhe bahut hi sukoon feel ho raha hai. Truly grateful for your energy and light.'),
  ('Ms. Nayana', 'Amravati', 'Personal consultation', 'en', 3,
   'She earnestly answered all my queries in a prompt and clear manner. Her patience and warmth made the entire session a truly comfortable and enlightening experience.',
   'I took a session from Madam a couple of days ago. Madam earnestly answered every query I asked. She answered them promptly and in a clear, direct way. She helped me in a polite and cooperative manner throughout the session. Her patience and warmth made the entire experience truly comfortable and enlightening.'),
  ('Ms. Prachi', 'Ranchi', 'Reading and healing', 'en', 4,
   'She not only helped me heal but also gave me simple, practical solutions. Whenever I am in a dilemma, she reaches out the same day. I feel truly thankful to have found her.',
   'I am very grateful that I found Rekha Bala during one of the most difficult phases of my life. She not only helped me heal but also gave me simple and practical solutions for life. Whenever I am in dilemma or tension, she tries to reach out the same day and helps me heal as soon as possible. Her guidance has also given me clarity in my competitive exam journey. I truly feel thankful, emotional, and blessed to have found her.')
) as v(name, location, service, language, sort_order, review, full_review)
where not exists (select 1 from public.reviews r where trim(r.name) = v.name);
