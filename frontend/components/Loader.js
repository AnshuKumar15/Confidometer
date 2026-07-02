"use client";

import { motion } from "framer-motion";

export default function Loader({ title = "Processing your speech", subtitle = "Crunching multimodal signals..." }) {
  return (
    <section className="loader glass">
      <motion.div
        className="loader-ring"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {title}
      </motion.h2>
      <p>{subtitle}</p>
      <div className="loader-bar">
        <motion.span
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </section>
  );
}
