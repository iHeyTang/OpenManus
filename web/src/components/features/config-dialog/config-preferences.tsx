'use client';

import { getPreferences, updatePreferences } from '@/actions/config';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { localeNames } from '@/i18n/config';
import { locales } from '@/i18n/config';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '../theme-toggle';
import { useTheme } from 'next-themes';

export default function ConfigLlm(props: { onSuccess?: (success: boolean) => void }) {
  const t = useTranslations('config');
  const router = useRouter();

  const { setTheme, theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getPreferences({});
        setSelectedLanguage(config.data?.language || '');
      } catch (error) {
        toast.error(t('toast.loadConfigError'));
      }
    };
    loadConfig();
  }, [t]);

  const handleLanguageChange = async (value: string) => {
    setLoading(true);
    try {
      await updatePreferences({ language: value });
      setSelectedLanguage(value);
      toast.success(t('toast.updateSuccess'));
      props.onSuccess?.(true);
      router.refresh();
    } catch (error) {
      toast.error(t('toast.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppearanceChange = async (value: string) => {
    setTheme(value);
    props.onSuccess?.(true);
    router.refresh();
  };

  return (
    <>
      <DialogHeader className="mb-10">
        <DialogTitle>{t('preferences')}</DialogTitle>
        <DialogDescription>{t('preferencesDescription')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language" className="flex items-center gap-1">
            {t('language')}
          </Label>
          <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('languageSelectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {locales.map(language => (
                <SelectItem key={language} value={language}>
                  {localeNames[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="appearance" className="flex items-center gap-1">
            {t('appearance')}
          </Label>
          <Select value={theme} onValueChange={handleAppearanceChange} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('apperanceThemes.light')}</SelectItem>
              <SelectItem value="dark">{t('apperanceThemes.dark')}</SelectItem>
              <SelectItem value="system">{t('apperanceThemes.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
