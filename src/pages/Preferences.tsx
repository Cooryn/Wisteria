import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Slider,
  Stack,
  Card,
  CardContent,
  IconButton,
  Alert,
  alpha,
  Fade,
  InputAdornment,
  Popover,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store';
import { saveTechTag, getTechTags, clearTechTags, setPreference, getPreference } from '../services/database';
import type { TechTag, TagCategory } from '../types';

const POPULAR_LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java',
  'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart',
  'Scala', 'Elixir', 'Haskell', 'Lua', 'Shell',
];

const POPULAR_FRAMEWORKS = [
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt',
  'Express', 'FastAPI', 'Django', 'Flask', 'Spring',
  'Rails', 'Laravel', 'Gin', 'Actix', 'Tauri',
  'Electron', 'Flutter', 'React Native',
];

const POPULAR_TOOLS = [
  'Docker', 'Kubernetes', 'Terraform', 'GitHub Actions', 'CI/CD',
  'GraphQL', 'REST', 'gRPC', 'PostgreSQL', 'MongoDB',
  'Redis', 'Elasticsearch', 'Webpack', 'Vite', 'esbuild',
];

const ISSUE_LABELS = [
  'good first issue', 'help wanted', 'bug', 'enhancement',
  'documentation', 'hacktoberfest', 'easy', 'beginner',
];

export default function Preferences() {
  const {
    languages, setLanguages,
    frameworks, setFrameworks,
    tools, setTools,
    issueLabels, setIssueLabels,
    minStars, setMinStars,
    maxStars, setMaxStars,
    workDirectory, setWorkDirectory,
    showNotification,
  } = useAppStore();

  const [saved, setSaved] = useState(false);

  // Per-section custom tag input states
  const [customInputs, setCustomInputs] = useState<Record<TagCategory, string>>({
    language: '',
    framework: '',
    tool: '',
  });
  const [customAnchor, setCustomAnchor] = useState<Record<TagCategory, HTMLElement | null>>({
    language: null,
    framework: null,
    tool: null,
  });

  // Load from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const tags = await getTechTags();
        setLanguages(tags.filter((t) => t.category === 'language'));
        setFrameworks(tags.filter((t) => t.category === 'framework'));
        setTools(tags.filter((t) => t.category === 'tool'));

        const min = await getPreference('minStars');
        const max = await getPreference('maxStars');
        const labels = await getPreference('issueLabels');
        const dir = await getPreference('workDirectory');

        if (min) setMinStars(Number(min));
        if (max) setMaxStars(Number(max));
        if (labels) setIssueLabels(JSON.parse(labels));
        if (dir) setWorkDirectory(dir);
      } catch {
        // DB not ready
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = useCallback((name: string, category: TagCategory) => {
    const setter = category === 'language' ? setLanguages
      : category === 'framework' ? setFrameworks
      : setTools;
    const current = category === 'language' ? languages
      : category === 'framework' ? frameworks
      : tools;

    if (current.find((t) => t.name.toLowerCase() === name.toLowerCase())) return;
    setter([...current, { name, category, weight: 1.0 }]);
  }, [languages, frameworks, tools, setLanguages, setFrameworks, setTools]);

  const removeTag = useCallback((name: string, category: TagCategory) => {
    const setter = category === 'language' ? setLanguages
      : category === 'framework' ? setFrameworks
      : setTools;
    const current = category === 'language' ? languages
      : category === 'framework' ? frameworks
      : tools;

    setter(current.filter((t) => t.name !== name));
  }, [languages, frameworks, tools, setLanguages, setFrameworks, setTools]);

  const updateWeight = useCallback((name: string, category: TagCategory, weight: number) => {
    const setter = category === 'language' ? setLanguages
      : category === 'framework' ? setFrameworks
      : setTools;
    const current = category === 'language' ? languages
      : category === 'framework' ? frameworks
      : tools;

    setter(current.map((t) => t.name === name ? { ...t, weight } : t));
  }, [languages, frameworks, tools, setLanguages, setFrameworks, setTools]);

  const handleSave = useCallback(async () => {
    try {
      await clearTechTags();
      const allTags = [...languages, ...frameworks, ...tools];
      for (const tag of allTags) {
        await saveTechTag(tag);
      }
      await setPreference('minStars', String(minStars));
      await setPreference('maxStars', String(maxStars));
      await setPreference('issueLabels', JSON.stringify(issueLabels));
      await setPreference('workDirectory', workDirectory);

      setSaved(true);
      showNotification('偏好设置已保存', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      showNotification(`保存失败: ${err}`, 'error');
    }
  }, [languages, frameworks, tools, minStars, maxStars, issueLabels, workDirectory, showNotification]);

  const handleAddCustomTag = (category: TagCategory) => {
    const name = customInputs[category].trim();
    if (name) {
      addTag(name, category);
      setCustomInputs((prev) => ({ ...prev, [category]: '' }));
      setCustomAnchor((prev) => ({ ...prev, [category]: null }));
    }
  };

  const handlePickDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择工作目录',
      });
      if (selected && typeof selected === 'string') {
        setWorkDirectory(selected);
      }
    } catch (err) {
      showNotification(`选择目录失败: ${err}`, 'error');
    }
  };

  const renderTagSection = (
    title: string,
    category: TagCategory,
    tags: TechTag[],
    suggestions: string[]
  ) => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {title}
        </Typography>

        {/* Current tags with weight */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {tags.map((tag) => (
            <Chip
              key={tag.name}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {tag.name}
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    ({(tag.weight * 100).toFixed(0)}%)
                  </Typography>
                </Box>
              }
              color="primary"
              variant="outlined"
              onDelete={() => removeTag(tag.name, category)}
              deleteIcon={<DeleteIcon fontSize="small" />}
              sx={{
                borderRadius: 2,
                '& .MuiChip-label': { display: 'flex', alignItems: 'center' },
              }}
            />
          ))}
          {tags.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              尚未添加标签，从下方选择或自定义输入
            </Typography>
          )}
        </Stack>

        {/* Weight sliders for existing tags */}
        {tags.length > 0 && (
          <Box sx={{ mb: 2, px: 1 }}>
            {tags.map((tag) => (
              <Stack key={tag.name} direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ minWidth: 100 }}>{tag.name}</Typography>
                <Slider
                  value={tag.weight}
                  onChange={(_, v) => updateWeight(tag.name, category, v as number)}
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  size="small"
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`}
                />
              </Stack>
            ))}
          </Box>
        )}

        {/* Quick add suggestions + inline custom input */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          快速添加：
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {suggestions
            .filter((s) => !tags.find((t) => t.name.toLowerCase() === s.toLowerCase()))
            .slice(0, 12)
            .map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                size="small"
                onClick={() => addTag(suggestion, category)}
                icon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                  '&:hover': {
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  },
                }}
              />
            ))}

          {/* Inline "+ 自定义" chip */}
          <Chip
            label="+ 自定义"
            size="small"
            onClick={(e) =>
              setCustomAnchor((prev) => ({ ...prev, [category]: e.currentTarget }))
            }
            sx={{
              cursor: 'pointer',
              fontWeight: 600,
              borderStyle: 'dashed',
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.4),
              color: 'primary.main',
              backgroundColor: 'transparent',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              },
            }}
            variant="outlined"
          />

          {/* Popper for custom input */}
          <Popover
            open={Boolean(customAnchor[category])}
            anchorEl={customAnchor[category]}
            onClose={() =>
              setCustomAnchor((prev) => ({ ...prev, [category]: null }))
            }
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: { p: 1.5, mt: 0.5, borderRadius: 2 },
              },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                autoFocus
                size="small"
                placeholder="输入标签名..."
                value={customInputs[category]}
                onChange={(e) =>
                  setCustomInputs((prev) => ({ ...prev, [category]: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag(category)}
                sx={{ width: 180 }}
              />
              <IconButton
                color="primary"
                onClick={() => handleAddCustomTag(category)}
                disabled={!customInputs[category].trim()}
                size="small"
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Popover>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Fade in timeout={400}>
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                技术栈偏好
              </Typography>
              <Typography variant="body2" color="text.secondary">
                设置你的技术背景和偏好，让 Wisteria 找到最适合你的项目。
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              color={saved ? 'success' : 'primary'}
            >
              {saved ? '已保存 ✓' : '保存偏好'}
            </Button>
          </Stack>

          {renderTagSection('编程语言', 'language', languages, POPULAR_LANGUAGES)}
          {renderTagSection('框架 & 库', 'framework', frameworks, POPULAR_FRAMEWORKS)}
          {renderTagSection('工具 & 技术', 'tool', tools, POPULAR_TOOLS)}

          {/* Star range */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                项目规模偏好
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                设定感兴趣的项目星标范围
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={[minStars, maxStars > 50000 ? 50000 : maxStars]}
                  onChange={(_, v) => {
                    const [min, max] = v as number[];
                    setMinStars(min);
                    setMaxStars(max);
                  }}
                  min={0}
                  max={50000}
                  step={100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 10000, label: '10k' },
                    { value: 25000, label: '25k' },
                    { value: 50000, label: '50k+' },
                  ]}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Issue labels */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Issue 标签偏好
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                选择你感兴趣的 Issue 类型
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {ISSUE_LABELS.map((label) => {
                  const isSelected = issueLabels.includes(label);
                  return (
                    <Chip
                      key={label}
                      label={label}
                      onClick={() => {
                        if (isSelected) {
                          setIssueLabels(issueLabels.filter((l) => l !== label));
                        } else {
                          setIssueLabels([...issueLabels, label]);
                        }
                      }}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          {/* Work directory with folder picker */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                工作目录
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                设定 Fork 仓库的本地克隆目录
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="例如: C:\Projects\OpenSource"
                value={workDirectory}
                onChange={(e) => setWorkDirectory(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handlePickDirectory}
                        size="small"
                        sx={{ color: 'primary.main' }}
                      >
                        <FolderIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          {saved && (
            <Alert severity="success" sx={{ mb: 3 }}>
              偏好设置已保存！现在可以前往「探索」页面搜索匹配项目了。
            </Alert>
          )}
        </Box>
      </Fade>
    </Box>
  );
}
