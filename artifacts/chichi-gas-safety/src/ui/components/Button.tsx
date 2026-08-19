import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { actions } from '@/game/store';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  soundTone?: 'tap' | 'back' | 'meow';
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  soundTone = 'tap',
  onClick,
  children,
  ...props 
}: ButtonProps) {
  
  const variants = {
    primary: 'bg-primary text-primary-foreground shadow-md hover:shadow-lg border-2 border-primary-border/20',
    secondary: 'bg-secondary text-secondary-foreground shadow-md hover:shadow-lg border-2 border-secondary-border/20',
    outline: 'bg-white/80 backdrop-blur-sm border-2 border-primary/30 text-foreground hover:bg-white',
    ghost: 'bg-transparent text-foreground hover:bg-black/5',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-xl',
    md: 'px-5 py-2.5 text-base rounded-2xl',
    lg: 'px-8 py-4 text-xl rounded-3xl font-display',
    icon: 'p-3 rounded-full',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        actions.uiSound(soundTone);
        onClick?.(e);
      }}
      className={cn(
        'relative overflow-hidden font-bold transition-colors pointer-events-auto',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
