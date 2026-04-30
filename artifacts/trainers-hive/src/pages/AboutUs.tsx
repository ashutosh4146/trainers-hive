import React from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, Target, ShieldCheck, Zap, Globe, TrendingUp,
  Activity, ArrowRight, Handshake, Star,
} from "lucide-react";

const VALUES = [
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Trust First",
    desc: "Every trainer on our platform is vetted. We verify credentials, check references, and collect real client feedback before any listing goes live.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Speed & Efficiency",
    desc: "We built Trainers Hive to eliminate the back-and-forth. Vendors post in minutes; trainers respond the same day.",
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: "India-First, Globally Ready",
    desc: "We started by solving the corporate training sourcing problem in India — and we are scaling that model globally.",
  },
  {
    icon: <Handshake className="h-6 w-6" />,
    title: "Fairness for All",
    desc: "Independent trainers deserve a level playing field. We give individual experts the same visibility as large training firms.",
  },
];

const STATS = [
  { value: "500+", label: "Verified Trainers" },
  { value: "200+", label: "Organisations Served" },
  { value: "1,200+", label: "Training Engagements" },
  { value: "4.8 / 5", label: "Average Rating" },
];

const TEAM = [
  {
    name: "Ashutosh Singh",
    role: "Founder & CEO",
    bio: "15+ years in corporate L&D. Built Trainers Hive to fix the opaque, slow trainer-sourcing process he experienced first-hand.",
    initial: "A",
  },
  {
    name: "Priya Sharma",
    role: "Head of Trainer Quality",
    bio: "Former HR lead at a Fortune 500. Oversees vetting, onboarding, and quality assurance for every trainer on the platform.",
    initial: "P",
  },
  {
    name: "Rahul Mehta",
    role: "VP – Vendor Partnerships",
    bio: "Seasoned enterprise sales professional who has partnered with 100+ companies to design and deliver training programmes.",
    initial: "R",
  },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex flex-col items-center text-center gap-5">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Our Story
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              The B2B Marketplace Built<br className="hidden md:block" /> for India's Training Ecosystem
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Trainers Hive connects independent trainers and training companies with organisations that need them — transparently, efficiently, and at scale.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 max-w-5xl space-y-20">

        <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-6 text-center space-y-1">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Corporate training sourcing in India has historically been fragmented, time-consuming, and opaque. Organisations struggle to find the right trainer; great trainers struggle to get discovered.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Trainers Hive exists to change that. We are building a trusted, transparent marketplace where verified training professionals can showcase their expertise, and organisations can hire confidently — without the noise.
            </p>
          </div>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Activity className="h-5 w-5" />
                <span>Why we built this</span>
              </div>
              <blockquote className="text-sm text-muted-foreground italic leading-relaxed border-l-2 border-primary/30 pl-4">
                "I spent years trying to find the right trainer for our programmes — through referrals, LinkedIn DMs, and cold calls. It was slow and unreliable. Trainers Hive is the platform I wish had existed."
              </blockquote>
              <p className="text-xs text-muted-foreground font-medium">— Ashutosh Singh, Founder</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">What We Stand For</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Four principles that guide every decision we make at Trainers Hive.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="flex gap-4 rounded-xl border bg-card p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {v.icon}
                </div>
                <div>
                  <p className="font-semibold mb-1">{v.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">Meet the Team</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">The people behind Trainers Hive — practitioners who have lived the problem we are solving.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TEAM.map((member) => (
              <Card key={member.name}>
                <CardContent className="p-6 space-y-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
                    {member.initial}
                  </div>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-primary font-medium">{member.role}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-8 md:p-12 text-center space-y-5">
          <div className="flex justify-center">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Whether you are a trainer looking to grow your client base, or an organisation looking for the perfect training partner — Trainers Hive is your platform.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/trainers">
              <Button className="gap-2">
                <Users className="h-4 w-4" />
                Browse Trainers
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/hire-us">
              <Button variant="outline" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Hire Through Us
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
