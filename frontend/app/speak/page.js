"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, RotateCcw, Video, Mic, VideoOff, 
  Sparkles, Check, Globe, HelpCircle, ArrowRight 
} from "lucide-react";
import "./styles.css";

// ── TOPIC DATA SET ──
const TOPICS = {
  Finance: {
    Easy: [
      "Explain why saving money is important.",
      "What is a bank and how does it work?",
      "Why is budgeting useful for college students?",
      "What is the difference between a debit card and a credit card?",
      "Explain what an emergency fund is and why you need one.",
      "Why do people invest in gold or real estate?",
      "What is an ATM and how does it keep transactions secure?",
      "Why is impulse shopping bad for your financial health?"
    ],
    Medium: [
      "Should high schools teach personal finance and taxes?",
      "What is inflation and how does it affect our daily life?",
      "What is compound interest and why is it called the 8th wonder of the world?",
      "Explain the concept of risk vs reward in stock market investing.",
      "How do credit scores work and why do they matter for your future?",
      "What are index funds and why do so many financial experts recommend them?",
      "How does renting compare to buying a home over a 20-year horizon?",
      "What causes a housing market bubble to form and burst?"
    ],
    Hard: [
      "How does cryptocurrency differ from fiat money, and what are its risks?",
      "Explain quantitative easing to a non-economist.",
      "Discuss the pros and cons of universal basic income (UBI).",
      "How do central banks use interest rate hikes to fight inflation?",
      "Analyze the systemic economic risks of algorithmic high-frequency trading.",
      "Is GDP still an accurate metric for measuring national prosperity and happiness?",
      "What were the root structural causes of the 2008 global financial crisis?",
      "How will the tokenization of real-world assets transform global capital markets?"
    ]
  },
  Tech: {
    Easy: [
      "How has the internet changed the way we learn?",
      "Explain what an app is to someone from the 1950s.",
      "What is your favorite piece of technology and why?",
      "Why do we need passwords and cybersecurity protection?",
      "How does GPS on your phone know where you are?",
      "Explain why smartphones replaced cameras, music players, and maps.",
      "What is a search engine and how does it find information so quickly?",
      "Why is battery life still one of the biggest challenges for tech devices?"
    ],
    Medium: [
      "How is the iPad and AI generation gap reshaping technology habits between Gen Z and Gen Alpha?",
      "What is cloud computing and why do companies use it?",
      "Explain the difference between artificial intelligence and machine learning.",
      "Will augmented reality glasses eventually replace physical smartphones?",
      "How do algorithms keep users hooked on social media feeds for hours?",
      "What is open-source software and why is it essential for global innovation?",
      "Should tech companies be held legally responsible for user data breaches?",
      "How does 5G cellular technology differ fundamentally from 4G?"
    ],
    Hard: [
      "How does blockchain achieve decentralization without a trusted authority?",
      "Discuss the ethical implications of real-time facial recognition in public spaces.",
      "Will quantum computing render modern RSA encryption obsolete in our lifetime?",
      "Debate the existential risks versus economic benefits of Artificial General Intelligence (AGI).",
      "How will humanoid robotics impact blue-collar and service labor markets by 2035?",
      "Should autonomous AI weapons systems be banned by international Geneva conventions?",
      "Explain the architecture of Large Language Models and how attention mechanisms work.",
      "How can society solve the deepfake authenticity crisis before it undermines public trust?"
    ]
  },
  General: {
    Easy: [
      "Describe your favorite season and why you love it.",
      "Is reading books better than watching movies?",
      "What is the most important lesson you've learned in life?",
      "If you could travel anywhere tomorrow, where would you go and why?",
      "What makes a good friend and how do you maintain lifelong friendships?",
      "Describe a hobby that brings you joy and peace of mind.",
      "Why is getting 8 hours of sleep essential for human performance?",
      "If you could have dinner with any historical figure, who would it be?"
    ],
    Medium: [
      "Why is work-life balance critical for long-term career longevity?",
      "Should public transportation be free for all residents in metropolitan cities?",
      "How does social media affect public opinion, election outcomes, and mental health?",
      "Is remote work making society more isolated or more connected to local communities?",
      "How does travel broaden the mind and dismantle cultural stereotypes?",
      "Why do people fear public speaking more than almost any other fear?",
      "What role does failure play in building resilience and eventual success?",
      "Should tipping culture in restaurants be abolished in favor of living wages?"
    ],
    Hard: [
      "Should space exploration be prioritized over solving climate change on Earth?",
      "Discuss how globalization has impacted indigenous and local cultures around the world.",
      "Is artificial intelligence a threat or a catalyst to human creativity and art?",
      "How should legal systems evolve to handle algorithmic decision-making and bias?",
      "Can economic growth coexist indefinitely with planetary environmental boundaries?",
      "Is absolute free speech compatible with preventing dangerous viral misinformation?",
      "What ethical obligations do wealthy nations have toward climate refugees?",
      "How will genetic engineering (CRISPR) reshape human inequality in the 21st century?"
    ]
  },
  "Career & Leadership": {
    Easy: [
      "What is the best piece of career advice you have ever received?",
      "Why is asking questions during an interview just as important as answering them?",
      "How do you stay organized when juggling multiple deadlines?",
      "What qualities make someone a great teammate to work with?",
      "Why is listening more important than speaking in effective communication?",
      "How do you recover gracefully after making a noticeable mistake at work?",
      "What is the value of finding a professional mentor early in your career?",
      "Why are soft skills often more decisive than technical skills in promotions?"
    ],
    Medium: [
      "How should a leader handle conflict between two high-performing team members?",
      "What is the difference between being a manager and being an inspiring leader?",
      "How do you negotiate a salary increase without creating friction with your boss?",
      "How can managers foster psychological safety so employees speak up about mistakes?",
      "Is hustle culture productive, or is it a fast-track to burnout and cynicism?",
      "How do you give constructive negative feedback without demoralizing an employee?",
      "How should companies measure remote worker productivity fairly and accurately?",
      "Why do so many startups fail when transitioning from founder-led to executive-led?"
    ],
    Hard: [
      "How should an executive balance short-term quarterly earnings with long-term R&D bets?",
      "What strategies should a CEO use to lead a legacy company through rapid technological disruption?",
      "How do you maintain team morale and trust during massive company-wide layoffs?",
      "Discuss the ethics of employee monitoring software and surveillance in remote teams.",
      "How should leaders navigate decisions where every available option causes collateral harm?",
      "What frameworks can organizations use to systematically eliminate unconscious hiring biases?",
      "How do you transition an engineering organization from feature-shipping to outcome-driven product teams?",
      "Analyze the role of vulnerability and empathy in modern high-stakes crisis leadership."
    ]
  },
  "Sci-Fi & Future": {
    Easy: [
      "If you could possess any superpower for 24 hours, what would it be and why?",
      "Would you live on a colony on Mars if you could never return to Earth?",
      "If time travel existed, would you visit 100 years into the past or future?",
      "What futuristic gadget from a movie do you wish existed today?",
      "Would you trust a self-driving car to drive you through a mountain storm?",
      "If you could download a skill instantly Matrix-style, what would you learn?",
      "Would you eat 3D-printed lab-grown food if it tasted identical to natural food?",
      "Would you like to have an AI robot butler in your home?"
    ],
    Medium: [
      "Will humans ever achieve biological immortality through nanotechnology and gene editing?",
      "If a sentient AI asks for human rights, should society grant them legal personhood?",
      "Would you upload your consciousness to a virtual cloud server to live forever?",
      "How will Neuralink-style brain-computer interfaces change human communication?",
      "What happens to the global economy when fully autonomous robots perform all manual labor?",
      "Is terraforming Mars an achievable scientific goal or an engineering fantasy?",
      "What are the ethical dilemmas of genetically designing babies for higher intelligence?",
      "If alien life is discovered on an exoplanet, how will it change human philosophy and religion?"
    ],
    Hard: [
      "Analyze the Fermi Paradox: If intelligent life is probable, where is everybody?",
      "Discuss the ethics of simulated realities: Are we living in an ancestor simulation right now?",
      "How would human society restructure if an unlimited, clean energy source (like fusion) became free?",
      "What are the philosophical implications of teleportation if it destroys and recreates you?",
      "How will the militarization of low Earth orbit and lunar territory reshape geopolitical treaties?",
      "If humanity creates digital superintelligence, can it ever be reliably aligned with human values?",
      "Discuss Dyson spheres and the energy transition necessary to become a Type II Kardashev civilization.",
      "How will climate geoengineering (stratospheric aerosol injection) impact international sovereignty?"
    ]
  },
  "Philosophy & Ethics": {
    Easy: [
      "Is honesty always the best policy, or are white lies sometimes necessary?",
      "Can money buy happiness, or does it only eliminate financial anxiety?",
      "Do we have a duty to help strangers in need whenever we can?",
      "Is it better to have loved and lost than never to have loved at all?",
      "What is the difference between justice and revenge?",
      "Why is forgiveness often harder than holding a grudge?",
      "Is human nature fundamentally cooperative or competitive?",
      "Does social media make people more vain or just more visible?"
    ],
    Medium: [
      "Resolve the Trolley Problem: Pull the lever to save five people or do nothing?",
      "Do humans truly possess free will, or are all decisions predetermined by biology and environment?",
      "Is utilitarianism (greatest good for greatest number) a flawed moral philosophy?",
      "What gives human life meaning: achievement, relationships, or mindfulness?",
      "Is privacy an inherent fundamental human right, or a modern social construct?",
      "Can a violent revolution ever be morally justified to overthrow tyranny?",
      "Should art be judged independently from the moral character of the artist who made it?",
      "Is ignorance bliss, or is painful truth always preferable to comforting illusions?"
    ],
    Hard: [
      "Explore the Ship of Theseus paradox: If every component is replaced, is it still the same entity?",
      "Can a machine or artificial neural network ever experience genuine qualia and subjective consciousness?",
      "Analyze John Rawls' 'Veil of Ignorance' as a framework for designing a fair society.",
      "Is moral relativism defensible, or are there universal moral truths that apply across all civilizations?",
      "Discuss the ethics of anti-natalism: Is bringing new life into the world an unchosen harm?",
      "How does existential nihilism transform when re-imagined through optimistic existentialism?",
      "Can an algorithmic AI judge deliver fairer justice than an emotionally fallible human judge?",
      "What constitutes personal identity across time if our memories, bodies, and personalities constantly evolve?"
    ]
  },
  "Roast A Popular Thing": {
    Easy: [
      "Roast group chats that could have been an email.",
      "Roast slow walkers in busy airport hallways.",
      "Roast standard smartphone alarm clock ringtones.",
      "Roast people who clap when the airplane lands.",
      "Roast tiny restaurant menus written on giant chalkboards.",
      "Roast wireless earbuds that fall out the moment you start jogging.",
      "Roast automatic public restroom sinks that refuse to detect your hands.",
      "Roast packaging that requires a pair of scissors to open."
    ],
    Medium: [
      "Roast sourdough bread culture and sourdough starters with human names.",
      "Roast the concept of New Year's resolutions that die by January 12th.",
      "Roast typing 'haha' or 'lol' with a completely deadpan stone face.",
      "Roast people who post gym selfies with deep philosophical inspirational quotes.",
      "Roast open-plan office layouts where you hear every breath of your coworker.",
      "Roast 45-minute meetings that clearly should have been a two-sentence Slack message.",
      "Roast subscription apps that charge $9.99/week to scan a simple PDF document.",
      "Roast influencers who do 'clean my room with me' videos for 10 million followers."
    ],
    Hard: [
      "Roast influencers who do 'day in the life' videos of drinking matcha and doing absolutely nothing.",
      "Roast corporate buzzwords like 'synergy', 'circle back', 'touch base', and 'paradigm shift'.",
      "Roast people who write 'happy birthday' and professional endorsements on LinkedIn.",
      "Roast productivity gurus with 14-step morning routines involving cold plunges and journaling.",
      "Roast modern luxury fashion that sells distressed dirty sneakers for $1,800.",
      "Roast venture capitalists who describe every grocery delivery app as 'redefining human consciousness'.",
      "Roast endless streaming service subscriptions that cost more than old cable TV packages.",
      "Roast smart home appliances that require a Wi-Fi connection and firmware update to toast a bagel."
    ]
  },
  "One-Minute Pitch": {
    Easy: [
      "Pitch a coffee shop that only sells nitro cold brew and silence.",
      "Pitch a library that lets you loud-talk in designated hype zones.",
      "Pitch a smart pillow that always stays on the cool side.",
      "Pitch an umbrella that never turns inside out during windy rainstorms.",
      "Pitch an alarm clock that donates $5 of your money to your rival every time you hit snooze.",
      "Pitch socks that come with built-in magnetic pairs so they never get lost in the wash.",
      "Pitch a restaurant where the menu has only three items that rotate daily.",
      "Pitch a movie theater where talking is strictly punished by instant seat ejection."
    ],
    Medium: [
      "Pitch a luxury cruise that never leaves the dock and is just a floating quiet hotel.",
      "Pitch an app that finds the quietest table with power outlets in any restaurant.",
      "Pitch a digital pet rock that analyzes your tone of voice and offers passive-aggressive therapy.",
      "Pitch an airline where ticket price is based on how quietly and quickly you board.",
      "Pitch a gym where all the exercise equipment generates electricity to power the neighborhood.",
      "Pitch a social media platform where you can only post one photo per month.",
      "Pitch a subscription box that sends you mystery puzzles you must solve to unlock your snacks.",
      "Pitch a smart mirror that hypes you up with customized rap lyrics before your morning interview."
    ],
    Hard: [
      "Pitch a subscription service for socks that biodegradably self-destruct after three washes.",
      "Pitch a theme park dedicated entirely to waiting in ultra-fast, fun interactive queue lines.",
      "Pitch a clock that ticks backwards in perceived time to physiologically relieve stress.",
      "Pitch an AI mediator that automatically resolves domestic chore arguments based on sensor data.",
      "Pitch a city-wide pneumatic tube delivery network for freshly baked warm cookies in 90 seconds.",
      "Pitch an insurance company that covers the emotional damage of bad movie endings.",
      "Pitch a wearable device that gives you a gentle electric tingle whenever you're about to say 'like' or 'um'.",
      "Pitch an investment fund that only finances absurd inventions that scientists said were impossible."
    ]
  },
  "Defend The Worst Take": {
    Easy: [
      "Defend why pineapple on pizza is the absolute pinnacle of human culinary art.",
      "Defend why doing chores on a Saturday morning is actually a thrilling weekend activity.",
      "Defend why gloomy rainy days are vastly superior to bright sunny beach days.",
      "Defend why eating ice cream in the freezing winter is the optimal way to consume it.",
      "Defend why socks with sandals is the ultimate high-fashion aesthetic statement.",
      "Defend why cold leftover pizza for breakfast is better than freshly cooked pancakes.",
      "Defend why watching the movie with subtitles on is mandatory even in your native language.",
      "Defend why getting stuck in long lines is actually the best part of amusement parks."
    ],
    Medium: [
      "Defend why highway traffic jams are actually great for forced mental mindfulness.",
      "Defend why dropping your smartphone face down is a sign of impending good luck.",
      "Defend why stubbing your toe on the coffee table builds essential character resilience.",
      "Defend why spoilers actually make watching a movie or TV show significantly more enjoyable.",
      "Defend why Monday is objectively the greatest day of the entire seven-day week.",
      "Defend why you should never make your bed because it traps dust mites and wastes energy.",
      "Defend why loud typing on mechanical keyboards is an essential public service for workplace morale.",
      "Defend why lukewarm room-temperature tap water is better than crisp ice water."
    ],
    Hard: [
      "Defend why pineapples should immediately replace the US Dollar as the global reserve currency.",
      "Defend why sleeping directly on a hardwood floor makes you a superior strategic thinker.",
      "Defend why all computers and internet servers should be legally powered down for two months every year.",
      "Defend why receiving junk spam mail in your physical mailbox is a delightful human connection.",
      "Defend why meetings without agendas are the purest incubator of organic breakthrough innovation.",
      "Defend why misplacing your keys every morning keeps your spatial cognitive reflexes razor-sharp.",
      "Defend why wearing formal business suits while working from home alone boosts coding speed by 30%.",
      "Defend why forgetting birthdays is an altruistic act that liberates friends from reciprocal social obligations."
    ]
  },
  "Explain It Like You're 5": {
    Easy: [
      "Explain why the sky is blue using simple colors and air particles.",
      "Explain why leaves change color from green to orange in the autumn.",
      "Explain how a smartphone telephone lets you talk to your grandma miles away.",
      "Explain why we dream when our eyes are closed asleep at night.",
      "Explain why oceans have waves and where the water is running to.",
      "Explain how birds can fly in the air without having engines.",
      "Explain why bees buzz and make sweet golden honey in hives.",
      "Explain why ice cubes float to the top of a glass of lemonade."
    ],
    Medium: [
      "Explain what a volcano is using baking soda, vinegar, and hot underground soup.",
      "Explain how rain clouds are made from invisible water puddles rising into the sky.",
      "Explain how magnets stick to the refrigerator without any glue or tape.",
      "Explain what electricity is using tiny invisible running runner ants.",
      "Explain how the internet sends YouTube cartoons through magical glowing glass strings.",
      "Explain why the moon changes its shape from a banana to a giant round cookie.",
      "Explain what germs are and why washing hands with soapy bubbles defeats them.",
      "Explain how mirrors bounce light pictures right back into your eyes."
    ],
    Hard: [
      "Explain how the stock market works using chocolate chip cookies and trading cards.",
      "Explain what computer coding is using building blocks and secret recipe instructions.",
      "Explain what gravity is to a kid who wants to jump off the sofa and float to space.",
      "Explain what black holes in space are using a giant cosmic vacuum cleaner and heavy trampolines.",
      "Explain how airplane wings lift a 200-ton metal bird into the sky using air pressure.",
      "Explain what DNA is using a magical instruction cookbook passed down from parents.",
      "Explain how search engines find the right webpage out of billions in half a second.",
      "Explain what artificial intelligence is using a friendly robot that practices guessing animal pictures."
    ]
  },
  "Conspiracy Corner": {
    Easy: [
      "Convince me that birds are not real and are surveillance drones charging on power lines.",
      "Argue that sleep is a conspiracy invented by mattress companies to sell memory foam.",
      "Convince me that Mondays are engineered to be 30% shorter than Saturday and Sunday.",
      "Argue that custom secret handshakes are the hidden currency in elite underground clubs.",
      "Convince me that cereal is a soup and milk is broth hiding in plain daylight.",
      "Argue that dogs can secretly speak English but stay silent so they don't have to pay rent.",
      "Convince me that Wi-Fi signals carry the collective thoughts of house cats.",
      "Argue that the snooze button was designed by coffee companies to ensure morning dependency."
    ],
    Medium: [
      "Argue that the moon is made of Swiss cheese and the government is hiding the recipe.",
      "Convince me that bathroom mirrors are two-way portals to parallel dimension universes.",
      "Argue that shadows have their own secret lives when humans aren't looking.",
      "Convince me that traffic lights change to red deliberately when they detect you are running late.",
      "Argue that elevator music contains subliminal frequencies that make people buy snacks.",
      "Convince me that houseplants actively judge your interior decorating and lifestyle choices.",
      "Argue that lost single socks in the dryer are escaping through a wormhole to an island of unpaired socks.",
      "Convince me that GPS voices are actually retired spies having fun giving you scenic detours."
    ],
    Hard: [
      "Argue that domestic cats are actually alien observers sent to report on human civilization.",
      "Convince me that trees are whispering to each other through fungal roots about human haircuts.",
      "Argue that the Bermuda Triangle is a cosmic recycling portal for missing ship captains.",
      "Convince me that modern smartphones are training humans to become their personal battery carriers.",
      "Argue that Antarctica is concealing a tropical paradise preserved by ancient polar geysers.",
      "Convince me that time travel tourists are currently among us disguised as street fashion photographers.",
      "Argue that dreams are actually live broadcasts of your parallel self in an alternate universe.",
      "Convince me that the Earth's magnetic poles shift whenever humans start arguing about pineapple pizza."
    ]
  },
  "Hot Takes": {
    Easy: [
      "Hot take: physical books are overrated compared to the infinite convenience of e-readers.",
      "Hot take: breakfast foods (eggs, pancakes, bacon) taste 10x better when eaten for dinner.",
      "Hot take: dogs are secretly running the household and humans are just their hired staff.",
      "Hot take: cereal should always be eaten without milk for maximum crunch preservation.",
      "Hot take: amusement park rollercoasters are vastly less scary than public karaoke.",
      "Hot take: texting with punctuation and periods makes you sound intimidating and angry.",
      "Hot take: going to the cinema alone is the most elite and peaceful movie experience possible.",
      "Hot take: pizza crust is the best part of the entire slice and throwing it away is a crime."
    ],
    Medium: [
      "Hot take: remote work is making people forget basic face-to-face small-talk social skills.",
      "Hot take: tea is vastly superior to coffee in energy stability, flavor nuance, and health benefits.",
      "Hot take: the movie adaptation is almost always better paced than the original 800-page book.",
      "Hot take: hustle culture is a scam designed to extract unpaid overtime from ambitious juniors.",
      "Hot take: noise-cancelling headphones are the single greatest invention in modern history.",
      "Hot take: social media likes and follower counts should be permanently hidden from public view.",
      "Hot take: voice notes are selfish because they demand 3 minutes of listening for a 5-word answer.",
      "Hot take: university degrees will be optional for 80% of high-paying tech jobs in five years."
    ],
    Hard: [
      "Hot take: professional traditional sports will eventually be eclipsed in viewership by competitive esports.",
      "Hot take: cooking from scratch every night is an economic waste of time in the era of automated meal prep.",
      "Hot take: artificial intelligence will produce emotionally superior music and poetry compared to human artists.",
      "Hot take: physical currency will be completely illegal in most developed economies within 15 years.",
      "Hot take: remote international hiring will equalize global salaries faster than any government policy.",
      "Hot take: the standard 40-hour work week will collapse to a 24-hour work week before 2040.",
      "Hot take: individual car ownership in major cities will be banned in favor of autonomous rideshare fleets.",
      "Hot take: traditional resume CVs are completely useless and should be replaced by live coding and speaking telemetry."
    ]
  },
  "Millennial & Pop Culture": {
    Easy: [
      "Explain why avocado toast is worth paying a mortgage down payment for.",
      "Defend your collection of 19 indoor house plants that you treat like your own children.",
      "Explain why you prefer sending a 6-word text rather than answering an unexpected phone call.",
      "Why is finding a close parking spot at the grocery store the ultimate adult thrill?",
      "Defend keeping 64 unread browser tabs open because 'you will definitely read them later'.",
      "Why is wearing comfortable sneakers with formal work outfits the greatest fashion revolution?",
      "Defend the emotional attachment to the nostalgic pop music of the late 1990s and early 2000s.",
      "Explain why buying another reusable water bottle brings immense temporary joy."
    ],
    Medium: [
      "Explain the universal dread when someone calls your phone without texting first.",
      "Defend having an elaborate 10-step nighttime skincare routine that takes 45 minutes.",
      "Why do people re-watch the same TV show (like The Office or Friends) for the 14th time for comfort?",
      "Defend spending $7 on an iced oat milk caramel latte every morning before work.",
      "Why is staying home on a Friday night in sweatpants the pinnacle of weekend luxury?",
      "Explain why making dinner plans two weeks in advance causes crippling social anxiety.",
      "Defend holding on to concert ticket stubs and wristbands from ten years ago.",
      "Why is shopping for kitchen organizers and air fryers the true benchmark of adulthood?"
    ],
    Hard: [
      "Analyze the psychological shift from consumer materialism to experience-driven memory collecting in younger generations.",
      "Why has the boundary between work hours and personal life completely dissolved in the digital nomad era?",
      "How did meme culture evolve from simple internet jokes into a primary medium for political and social commentary?",
      "Defend the choice of prioritizing pet adoption and pet insurance over traditional homeownership milestones.",
      "Discuss how algorithm-driven micro-trends on TikTok have shortened the cultural lifecycle of fashion and music.",
      "How has parasocial relationships with internet creators altered how audiences form personal identity and trust?",
      "Analyze why nostalgic comfort media surges dramatically during periods of economic and geopolitical uncertainty.",
      "How will the transition from physical social hubs to digital metaverse communities shape future generations?"
    ]
  }
};

const LANGUAGES = ["US EN", "UK EN", "IN EN"];
const DIFFICULTIES = ["Random", "Easy", "Medium", "Hard"];
const CATEGORIES = [
  "Random",
  "General",
  "Tech",
  "Finance",
  "Career & Leadership",
  "Sci-Fi & Future",
  "Philosophy & Ethics",
  "Roast A Popular Thing",
  "One-Minute Pitch",
  "Defend The Worst Take",
  "Explain It Like You're 5",
  "Conspiracy Corner",
  "Hot Takes",
  "Millennial & Pop Culture"
];

// Helper to pick a random item
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate a clean mechanical slot machine click dynamically using Web Audio API
const playClickSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";

    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

    gain.gain.setValueAtTime(0.18, now); 
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.start(now);
    osc.stop(now + 0.05);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 80);
  } catch (err) {
    console.warn("Failed to play mechanical click sound:", err);
  }
};

// Generate a bright major-triad Game Show chime chord dynamically using Web Audio API
const playTadaSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // "Ta" - single note (C5 - 523.25Hz) 
    playNote(523.25, now, 0.08, 0.12);

    // "Da!" - Chord major triad starting 100ms later (E5 - 659.25Hz, G5 - 783.99Hz, C6 - 1046.50Hz)
    playNote(659.25, now + 0.1, 0.35, 0.10);
    playNote(783.99, now + 0.1, 0.35, 0.10);
    playNote(1046.50, now + 0.1, 0.35, 0.08);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch (err) {
    console.warn("Failed to play tada sound:", err);
  }
};

// Generate a retro 8-bit "ta ta taaan" square wave sound (Super Mario style)
// Stretched by 1 / 0.85 (~1.176x) delay. Volumes increased and final note sustained longer.
const playTaTaTaaanSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Square wave generates the iconic 8-bit NES synthesizer buzz
      osc.type = "square"; 
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // "ta" - E5 (659.25 Hz) at 0ms (volumes increased for louder playback)
    playNote(659.25, now, 0.08, 0.09);

    // "ta" - E5 (659.25 Hz) at 120ms
    playNote(659.25, now + 0.12, 0.08, 0.09);

    // "taaan" - G5 (783.99 Hz) at 240ms (increased volume and duration from 0.38s to 0.65s for sustain)
    playNote(783.99, now + 0.24, 0.65, 0.11);

    // Extended close timer to 1.1s so the longer final note is not clipped
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1100);
  } catch (err) {
    console.warn("Failed to play ta-ta-taaan sound:", err);
  }
};

// Generate a premium, sparkling crystal arpeggio start signal dynamically using Web Audio API
const playStartChimeSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine"; 
      osc.frequency.setValueAtTime(freq, start);

      // Volume envelope: soft fade-in, long exponential fade-out
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // Ascending C-Major 9th arpeggio
    playNote(523.25, now, 0.45, 0.08);         // C5
    playNote(659.25, now + 0.06, 0.45, 0.07);  // E5
    playNote(783.99, now + 0.12, 0.45, 0.06);  // G5
    playNote(1174.66, now + 0.18, 0.65, 0.05); // D6 (high sparkling 9th, sustains longer)

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (err) {
    console.warn("Failed to play start chime sound:", err);
  }
};

// Helper function to return visual emojis for each Category matching the screenshots
const getCategoryEmoji = (cat) => {
  if (cat === "Random") return "🎯";
  if (cat === "General") return "💬";
  if (cat === "Tech") return "💻";
  if (cat === "Finance") return "💰";
  if (cat === "Roast A Popular Thing") return "🔥";
  if (cat === "One-Minute Pitch") return "💡";
  if (cat === "Defend The Worst Take") return "🤡";
  if (cat === "Explain It Like You're 5") return "👶";
  if (cat === "Conspiracy Corner") return "🛸";
  if (cat === "Hot Takes") return "🌶️";
  if (cat === "Millennial") return "🥑";
  return "🎯";
};

export default function SpeakPage() {
  // Page state: 'setup' or 'active'
  const [mode, setMode] = useState("setup");

  // Selection states
  const [language, setLanguage] = useState("US EN");
  const [difficulty, setDifficulty] = useState("Medium");
  const [category, setCategory] = useState("Random");

  // Dropdown open states
  const [langOpen, setLangOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  // Spinner states
  const [selectedTopic, setSelectedTopic] = useState(
    "Is \"deinfluencing\" genuine or just another form of influencing?"
  );
  const [spinning, setSpinning] = useState(false);
  const [ribbonTopics, setRibbonTopics] = useState([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [visibleActiveIndex, setVisibleActiveIndex] = useState(1);

  // Slot machine pull lever state
  const [leverPulled, setLeverPulled] = useState(false);

  // Timer states
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalTime, setTotalTime] = useState(60);

  // Client-side recorded video state
  const [recordingBlobUrl, setRecordingBlobUrl] = useState(null);

  // Media capture stream & Web Audio API visualizer refs
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Ref flag to ignore next onstop trigger (used for discarding recordings on reset)
  const ignoreNextRecordRef = useRef(false);

  // Media Recorder refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Lock body scroll while on the Speak page
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  // Initialize slot ribbon topics
  useEffect(() => {
    // Collect all topics to populate default list
    const all = [];
    Object.keys(TOPICS).forEach((c) => {
      Object.keys(TOPICS[c]).forEach((d) => {
        all.push(...TOPICS[c][d]);
      });
    });
    // Shuffle and pick 15
    const shuffled = [...all].sort(() => 0.5 - Math.random()).slice(0, 15);
    // Insert target topics at index 0, 1, 2 matching the screenshot
    shuffled[0] = "Roast the concept of \"disruption\" in tech.";
    shuffled[1] = "Is \"deinfluencing\" genuine or just another form of influencing?";
    shuffled[2] = "Roast the entire concept of \"adulting\" books and classes.";
    setRibbonTopics(shuffled);
    setScrollOffset(0);
    setVisibleActiveIndex(1);
    setSelectedTopic("Is \"deinfluencing\" genuine or just another form of influencing?");
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setLangOpen(false);
      setDiffOpen(false);
      setCatOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Reactively connect stream object to the DOM video ref after mounting
  useEffect(() => {
    if (videoRef.current && stream && !recordingBlobUrl) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, recordingBlobUrl]);

  // Disable body scrollbars in active practice mode to lock screen layout and prevent scrolling
  useEffect(() => {
    if (mode === "active") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode]);

  // Timer Countdown loop
  useEffect(() => {
    let intervalId;
    if (mode === "active" && isPlaying && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleStopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [mode, isPlaying, timeLeft]);

  // Stop camera stream tracks and clear objects
  const stopMediaStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Perform Slot Spin Animation (JS scroll loop to scale middle item dynamically)
  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setLeverPulled(true);

    // Release lever after 350ms
    setTimeout(() => {
      setLeverPulled(false);
    }, 350);

    // 1. Resolve filtered list of topics for the target
    let finalPool = [];
    const catKeys = category === "Random" ? Object.keys(TOPICS) : [category];
    const diffKeys = difficulty === "Random" ? ["Easy", "Medium", "Hard"] : [difficulty];

    catKeys.forEach((c) => {
      diffKeys.forEach((d) => {
        if (TOPICS[c] && TOPICS[c][d]) {
          finalPool.push(...TOPICS[c][d]);
        }
      });
    });

    if (finalPool.length === 0) {
      finalPool = ["Is the gap between Gen Z and Gen Alpha already huge?"];
    }

    const landedTopic = pickRandom(finalPool);

    // 2. Collect all topics globally to show rich variety in the reel
    const allTopics = [];
    Object.keys(TOPICS).forEach((c) => {
      Object.keys(TOPICS[c]).forEach((d) => {
        allTopics.push(...TOPICS[c][d]);
      });
    });

    // Exclude the landed topic from the global reel pool to prevent duplicates adjacent to target
    const globalPoolWithoutTarget = allTopics.filter((t) => t !== landedTopic);

    // 3. Create a set of 20 topics to spin through, with target at index 15
    const spinPool = [];
    for (let i = 0; i < 20; i++) {
      if (i === 15) {
        spinPool.push(landedTopic);
      } else {
        // Pick unique topics for adjacent slots
        let nextTopic = pickRandom(globalPoolWithoutTarget);
        // Make sure adjacent items (i-1) are not the same
        while (spinPool.length > 0 && spinPool[spinPool.length - 1] === nextTopic) {
          nextTopic = pickRandom(globalPoolWithoutTarget);
        }
        spinPool.push(nextTopic);
      }
    }

    setRibbonTopics(spinPool);

    // JS animation loop driving offset with a strong ease-out quintic deceleration curve
    const duration = 2200; 
    const start = Date.now();
    let lastIndex = 1;
    
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      
      // Quintic ease-out deceleration curve for natural slowing down physics
      const eased = 1 - Math.pow(1 - t, 4.5); 
      const currentFloatIndex = 1 + eased * 14;
      
      // Calculate offset: translation is based on currentFloatIndex
      const offset = (currentFloatIndex - 1) * 80;
      setScrollOffset(offset);
      
      // Active index is the closest rounded item
      const currentIdx = Math.round(currentFloatIndex);
      setVisibleActiveIndex(currentIdx);
      
      // If the index has transitioned, play the mechanical click audio tick
      if (currentIdx !== lastIndex) {
        playClickSound();
        lastIndex = currentIdx;
      }
      
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setSelectedTopic(landedTopic);
        setSpinning(false);
        setScrollOffset(1120); // (15 - 1) * 80 = 1120px
        setVisibleActiveIndex(15);
        playTadaSound(); // Trigger game show polyphonic chime!
      }
    };
    requestAnimationFrame(tick);
  };

  // Helper to request & activate camera stream
  const startCameraStream = async () => {
    if (stream) return stream;
    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      setStream(activeStream);

      // Initialize Web Audio API visualizer
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioContextRef.current) {
        const audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(activeStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      }
      return activeStream;
    } catch (err) {
      console.warn("Failed to gain device access:", err);
      return null;
    }
  };

  // Start active mode and turn on camera stream immediately
  const handleStartTimer = async () => {
    setMode("active");
    setTimeLeft(totalTime);
    setIsPlaying(false);
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
    await startCameraStream();
  };

  // Triggered when user plays/pauses speaking countdown
  const handlePlayPause = async () => {
    if (isPlaying) {
      // Pause countdown
      setIsPlaying(false);
      
      // Pause MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }
    } else {
      // If the timer is set to 0, prevent starting
      if (timeLeft <= 0) {
        return;
      }

      // Play countdown
      setIsPlaying(true);
      playStartChimeSound(); // Trigger the premium ascending bell arpeggio!

      // 1. Ensure stream is active
      let activeStream = await startCameraStream();
      if (!activeStream) {
        setIsPlaying(false);
        return;
      }

      // 2. Start or Resume MediaRecorder
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        // Initialize fresh MediaRecorder
        recordedChunksRef.current = [];
        const options = { mimeType: "video/webm" };
        let recorder;
        try {
          recorder = new MediaRecorder(activeStream, options);
        } catch (e) {
          recorder = new MediaRecorder(activeStream);
        }

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          if (ignoreNextRecordRef.current) {
            ignoreNextRecordRef.current = false;
            return; // Discard
          }
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setRecordingBlobUrl(url);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
      } else if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }
    }
  };

  // Stop recording, trigger blob creation, and stop live stream
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopMediaStream();
    setIsPlaying(false);
  };

  // Increase/Decrease timer, preserving elapsed speaking progress if adjusted mid-recording
  const adjustTimer = (seconds) => {
    if (timeLeft === totalTime) {
      const nextVal = Math.max(0, Math.min(600, totalTime + seconds));
      setTotalTime(nextVal);
      setTimeLeft(nextVal);
    } else {
      const nextTotal = Math.max(0, Math.min(600, totalTime + seconds));
      const diff = nextTotal - totalTime;
      setTotalTime(nextTotal);
      setTimeLeft((prev) => Math.max(0, Math.min(nextTotal, prev + diff)));
    }
  };

  // Reset the active practice timer and clear previous recording - stays on the same topic practice view!
  // Keeps the camera stream active so they are immediately ready to start fresh
  const handleTimerReset = () => {
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
    // Stop recording and tell onstop to ignore creating the review blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      ignoreNextRecordRef.current = true;
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    setIsPlaying(false);
    setTimeLeft(totalTime);
  };

  // Reset/Return to spinner - completely revokes and dumps the video from memory
  const handleReset = () => {
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
    stopMediaStream();
    setIsPlaying(false);
    setMode("setup");
    setScrollOffset(0);
    setVisibleActiveIndex(1);
  };

  useEffect(() => {
    return () => {
      if (recordingBlobUrl) {
        URL.revokeObjectURL(recordingBlobUrl);
      }
    };
  }, [recordingBlobUrl]);

  // Circle timer path definitions (increased radius for larger radial)
  const radius = 105;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalTime > 0 
    ? circumference - (timeLeft / totalTime) * circumference 
    : 0;

  // Retrieve emojis for current difficulty
  const getDiffEmoji = (d) => {
    if (d === "Easy") return "🟢";
    if (d === "Medium") return "🟡";
    if (d === "Hard") return "🔴";
    return "🟣";
  };

  return (
    <div className="speak-cream-band">
      <div className="speak-page-wrapper">

        {/* Top left "Back" button shown only in active mode */}
        {mode === "active" && (
          <button 
            type="button" 
            className="speak-back-btn"
            onClick={handleReset}
            title="Back to Topic Selector"
          >
            ← Back
          </button>
        )}

        {mode === "setup" ? (
          /* ═══════════════ SPIN MODE (SETUP) ═══════════════ */
          <div className="speak-grid-layout">
            
            {/* Left Column Instructions */}
            <div className="speak-sidebar-card">
              <div className="speak-brand-logo-section">
                <h1 className="speak-brand-title">
                  Get Set<br />
                  Speak
                </h1>
                <div className="speak-steps-list">
                  <div className="speak-step-item">
                    <span className="speak-step-text">1) Get random topic</span>
                  </div>
                  <div className="speak-step-item">
                    <span className="speak-step-text">2) Set 1 min timer</span>
                  </div>
                  <div className="speak-step-item">
                    <span className="speak-step-text">3) Record & speak !!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column Slot machine container */}
            <div className="speak-play-card">
              
              {/* Inner container to center everything relative to the viewport */}
              <div className="speak-play-inner">
                
                {/* Custom dropdown headers matching the screenshot pills exactly */}
                <div className="speak-selectors-header">

                  {/* Difficulty Pill dropdown */}
                  <div className="speak-selector-pill" onClick={(e) => { e.stopPropagation(); setDiffOpen(!diffOpen); setLangOpen(false); setCatOpen(false); }}>
                    <button type="button" className="speak-pill-btn">
                      <span>{getDiffEmoji(difficulty)} {difficulty} ▾</span>
                    </button>
                    {diffOpen && (
                      <div className="speak-dropdown-panel">
                        {DIFFICULTIES.map((diff) => (
                          <button 
                            key={diff} 
                            type="button" 
                            className={`speak-dropdown-item ${difficulty === diff ? "active" : ""}`}
                            onClick={() => setDifficulty(diff)}
                          >
                            <span>{getDiffEmoji(diff)} {diff}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Pill dropdown */}
                  <div className="speak-selector-pill" onClick={(e) => { e.stopPropagation(); setCatOpen(!catOpen); setLangOpen(false); setDiffOpen(false); }}>
                    <button type="button" className="speak-pill-btn">
                      <span>{getCategoryEmoji(category)} {category} ▾</span>
                    </button>
                    {catOpen && (
                      <div className="speak-dropdown-panel">
                        {CATEGORIES.map((cat) => (
                          <button 
                            key={cat} 
                            type="button" 
                            className={`speak-dropdown-item ${category === cat ? "active" : ""}`}
                            onClick={() => setCategory(cat)}
                          >
                            <span>{getCategoryEmoji(cat)} {cat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Vertical scrolling slot picker viewport */}
                <div className="speak-slot-viewport">
                  <div className="speak-slot-highlight-bar" />
                  <div 
                    className={`speak-slot-ribbon ${spinning ? "spinning" : ""}`}
                    style={{
                      transform: `translate3d(0, -${scrollOffset}px, 0)`
                    }}
                  >
                    {ribbonTopics.map((topic, i) => (
                      <div 
                        key={i} 
                        className={`speak-slot-item ${i === visibleActiveIndex ? "active" : ""}`}
                      >
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spin / Trigger buttons centered at bottom of viewport */}
                <div className="speak-action-row">
                  <button 
                    type="button" 
                    className="speak-btn-spin"
                    onClick={handleSpin}
                    disabled={spinning}
                  >
                    {spinning ? "Spinning..." : "Spin!"}
                  </button>

                  <button 
                    type="button" 
                    className="speak-btn-timer"
                    onClick={handleStartTimer}
                    disabled={spinning}
                  >
                    Start Timer →
                  </button>
                </div>

              </div>

              {/* Pull Lever spinner handle on the right of the centered column */}
              <div className="speak-lever-container">
                <span className="speak-lever-lbl">pull lever<br />↓</span>
                <div className="speak-lever-track" />
                <button 
                  type="button" 
                  className="speak-lever-handle" 
                  style={{
                    top: leverPulled ? "90px" : "15px"
                  }}
                  onClick={handleSpin}
                  disabled={spinning}
                  title="Pull lever to spin"
                >
                  <span className="stripe" />
                  <span className="stripe" />
                  <span className="stripe" />
                </button>
                <div className="speak-lever-dot" />
              </div>

            </div>

          </div>
        ) : (
          /* ═══════════════ TIMER & PRACTICE MODE (ACTIVE) ═══════════════ */
          <div className="speak-active-wrapper">
            
            {/* Left Column: Webcam preview or playback video player */}
            <div className="speak-camera-card">
              <div className="speak-camera-viewport">
                {recordingBlobUrl ? (
                  /* Show recorded video player controls */
                  <video 
                    src={recordingBlobUrl}
                    controls
                    className="speak-playback-video"
                  />
                ) : stream ? (
                  /* Show live stream preview */
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="speak-camera-preview"
                  />
                ) : (
                  /* Show start placeholder before play is pressed */
                  <div className="speak-camera-placeholder">
                    <Video size={48} className="placeholder-icon" />
                    <span>Camera ready. Click Play below to start speaking.</span>
                  </div>
                )}
                
                {/* Overlay live indicator badge */}
                {!recordingBlobUrl && stream && (
                  <div className="speak-camera-overlay">
                    <div className="speak-mic-badge">
                      <span className="speak-red-dot" />
                      <Mic size={14} />
                      <span>
                        {isPlaying ? "Recording Live" : "Live"} • {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Timer progress bar or recording review actions */}
            <div className="speak-timer-panel">
              
              {recordingBlobUrl ? (
                /* Post-recording actions panel */
                <div className="speak-recorded-actions">
                  <h3>Review Practice</h3>
                  <p>Your video is saved temporarily. You can watch/download it below, or return to the spinner to try another topic.</p>
                  
                  <div className="speak-recorded-buttons">
                    <a 
                      href={recordingBlobUrl} 
                      download={`practice-speak-${Math.floor(Date.now() / 1000)}.webm`}
                      className="speak-btn-finish"
                      style={{ textDecoration: "none", textAlign: "center", display: "block" }}
                    >
                      Download Video
                    </a>
                    
                    <button 
                      type="button" 
                      className="speak-btn-timer" 
                      onClick={handleReset}
                      style={{ width: "100%", background: "#ffffff" }}
                    >
                      ← Spin Another Topic
                    </button>
                  </div>
                </div>
              ) : (
                /* Circular SVG Timer and Play/Pause controller bar */
                <>
                  <div className="speak-active-topic-heading">
                    <span className="speak-active-topic-lbl">Topic:</span>
                    <p className="speak-active-topic-text">"{selectedTopic}"</p>
                  </div>

                  <div className="speak-timer-radial-box">
                    <svg className="speak-timer-svg" width="240" height="240" viewBox="0 0 240 240">
                      <circle 
                        className="speak-timer-ring-bg"
                        cx="120" 
                        cy="120" 
                        r={radius} 
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      <circle 
                        className="speak-timer-ring-fill"
                        cx="120" 
                        cy="120" 
                        r={radius} 
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="speak-timer-text-display">
                      <span className="speak-timer-value">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                      </span>
                      
                      {/* Plus/Minus adjustments disappear after user starts speaking, reappear when paused */}
                      {!isPlaying && (
                        <div className="speak-timer-adjust-row">
                          <button type="button" className="speak-adjust-btn" onClick={() => adjustTimer(-30)}>-0:30</button>
                          <button type="button" className="speak-adjust-btn" onClick={() => adjustTimer(30)}>+0:30</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stop, Start, play/pause controller bar */}
                  <div className="speak-control-row">
                    <button 
                      type="button" 
                      className="speak-btn-circle reset"
                      onClick={handleTimerReset}
                      title="Reset Timer"
                    >
                      <RotateCcw size={20} />
                    </button>

                    <button 
                      type="button" 
                      className="speak-btn-circle play"
                      onClick={handlePlayPause}
                      title={isPlaying ? "Pause" : "Play"}
                      style={{ opacity: timeLeft <= 0 ? 0.5 : 1, cursor: timeLeft <= 0 ? "not-allowed" : "pointer" }}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: "4px" }} />}
                    </button>
                  </div>
                </>
              )}

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
