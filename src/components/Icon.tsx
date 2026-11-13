import React from 'react'
import {
  Award, Baby, Bath, Bed, Bike, Bone, BookOpen, Briefcase, Brush, Building2, Calendar, Camera,
  Car, Cat, CircleCheck, Clock, Coffee, CreditCard, Dog, Droplets, Dumbbell, Flame, Flower2,
  Gift, Globe, GraduationCap, Hammer, HandHeart, Heart, Home, Key, Laptop, Leaf, Lightbulb,
  Lock, Mail, MapPin, MessageCircle, Music, Palette, PawPrint, Phone, Plane, Rocket, Scale,
  Scissors, ShieldCheck, Shirt, ShoppingBag, Smartphone, Smile, Sparkles, Star, Stethoscope,
  Sun, Target, ThumbsUp, TreePine, TrendingUp, Truck, Users, Utensils, Wine, Wrench, Zap,
} from 'lucide-react'

import { cn } from '@/utilities/ui'

/** The icon names an owner (or Claude) can type into an "icon" field. */
const icons = {
  award: Award, baby: Baby, bath: Bath, bed: Bed, bike: Bike, bone: Bone, book: BookOpen,
  briefcase: Briefcase, brush: Brush, building: Building2, calendar: Calendar, camera: Camera,
  car: Car, cat: Cat, check: CircleCheck, clock: Clock, coffee: Coffee, card: CreditCard,
  dog: Dog, droplets: Droplets, dumbbell: Dumbbell, flame: Flame, flower: Flower2, gift: Gift,
  globe: Globe, graduation: GraduationCap, hammer: Hammer, care: HandHeart, heart: Heart,
  home: Home, key: Key, laptop: Laptop, leaf: Leaf, lightbulb: Lightbulb, lock: Lock,
  mail: Mail, pin: MapPin, message: MessageCircle, music: Music, palette: Palette,
  paw: PawPrint, phone: Phone, plane: Plane, rocket: Rocket, scale: Scale, scissors: Scissors,
  shield: ShieldCheck, shirt: Shirt, bag: ShoppingBag, smartphone: Smartphone, smile: Smile,
  sparkles: Sparkles, star: Star, stethoscope: Stethoscope, sun: Sun, target: Target,
  thumbsup: ThumbsUp, tree: TreePine, growth: TrendingUp, truck: Truck, users: Users,
  utensils: Utensils, wine: Wine, wrench: Wrench, zap: Zap,
} as const

export const iconNames = Object.keys(icons).join(', ')

/** An icon from the list above in a tinted tile. Anything else (an emoji) is shown as typed. */
export const FeatureIcon: React.FC<{ name?: string | null; className?: string }> = ({
  name,
  className,
}) => {
  if (!name) return null
  const key = name.toLowerCase().replace(/[^a-z]/g, '') as keyof typeof icons
  const Icon = icons[key]
  return (
    <div
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius)*0.8)] text-2xl',
        className,
      )}
      style={{
        background: 'color-mix(in oklab, var(--up-primary) 12%, transparent)',
        color: 'var(--up-primary)',
      }}
    >
      {Icon ? <Icon className="h-6 w-6" aria-hidden /> : name}
    </div>
  )
}
