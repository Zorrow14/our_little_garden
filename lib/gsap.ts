import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Register once; import gsap/useGSAP from here rather than from "gsap" directly.
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
