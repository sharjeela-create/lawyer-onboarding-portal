import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCenterUser } from '@/hooks/useCenterUser';
import { Loader2 } from 'lucide-react';

const CenterAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { isCenterUser, loading: centerLoading } = useCenterUser();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !centerLoading) {
      if (isCenterUser) {
        toast({
          title: 'Welcome back!',
          description: 'You have been signed in successfully.',
        });
        navigate('/center-lead-portal');
      } else {
        // If logged in but not a center user, redirect to regular auth
        navigate('/auth');
      }
    }
  }, [user, isCenterUser, centerLoading, navigate, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signIn(email, password);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Center Lead Portal</h1>
          <p className="text-muted-foreground mt-2">Access your lead vendor dashboard</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Center Sign In</CardTitle>
            <CardDescription>Enter your center credentials to access your leads</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="center-email">Email</Label>
                <Input
                  id="center-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="center-password">Password</Label>
                <Input
                  id="center-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Not a center user?{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-normal"
              onClick={() => navigate('/auth')}
            >
              Back to Agent Portal
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CenterAuth;