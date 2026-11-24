import { useCallback, useEffect, useState } from 'react';

import type { SoundEntry } from '@/domain/sounds';
import { useServices } from '@/providers/services-provider';

export function useSoundLibrary() {
  const { soundService } = useServices();
  const [library, setLibrary] = useState<SoundEntry[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    soundService.library().then((list) => active && setLibrary(list));
    return () => {
      active = false;
    };
  }, [soundService, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { library, reload };
}
