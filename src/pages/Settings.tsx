import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Fade,
  InputAdornment,
  IconButton,
  Autocomplete,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  CheckCircle as ValidIcon,
  Cancel as InvalidIcon,
  GitHub as GitHubIcon,
  SmartToy as AIIcon,
  Terminal as GitIcon,
  DeleteSweep as ClearIcon,
} from '@mui/icons-material';
import { useAppStore } from '../store';
import { setSetting, getAllSettings } from '../services/database';
import { validateToken, initOctokit } from '../services/github';
import { validateOpenAIKey } from '../services/llm';
import { isGitAvailable, getGitVersion } from '../services/git';

export default function Settings() {
  const { settings, setSettings, setUser, showNotification } = useAppStore();

  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  // Load settings from DB
  useEffect(() => {
    (async () => {
      try {
        const all = await getAllSettings();
        setSettings({
          githubToken: all['githubToken'] ?? '',
          openaiApiKey: all['openaiApiKey'] ?? '',
          openaiModel: all['openaiModel'] ?? 'gpt-4o',
          openaiBaseUrl: all['openaiBaseUrl'] ?? 'https://api.openai.com/v1',
          themeMode: (all['themeMode'] as any) ?? 'system',
          workDirectory: all['workDirectory'] ?? '',
        });

        // Check token validity if token exists
        if (all['githubToken']) {
          const user = await validateToken(all['githubToken']);
          if (user) {
            setTokenValid(true);
            setUser(user);
            initOctokit(all['githubToken']);
          }
        }
      } catch {
        // DB not ready
      }

      // Check git
      try {
        const available = await isGitAvailable();
        setGitAvailable(available);
        if (available) {
          const ver = await getGitVersion();
          setGitVersion(ver);
        }
      } catch {
        setGitAvailable(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting('githubToken', settings.githubToken);
      await setSetting('openaiApiKey', settings.openaiApiKey);
      await setSetting('openaiModel', settings.openaiModel);
      await setSetting('openaiBaseUrl', settings.openaiBaseUrl);
      await setSetting('workDirectory', settings.workDirectory);

      showNotification('设置已保存', 'success');
    } catch (err) {
      showNotification(`保存失败: ${err}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [settings, showNotification]);

  const handleValidateToken = useCallback(async () => {
    setValidating('token');
    try {
      const user = await validateToken(settings.githubToken);
      if (user) {
        setTokenValid(true);
        setUser(user);
        initOctokit(settings.githubToken);
        showNotification(`验证成功！欢迎 ${user.name ?? user.login}`, 'success');
      } else {
        setTokenValid(false);
        showNotification('Token 无效，请检查', 'error');
      }
    } catch {
      setTokenValid(false);
      showNotification('验证失败', 'error');
    } finally {
      setValidating(null);
    }
  }, [settings.githubToken, setUser, showNotification]);

  const handleValidateApiKey = useCallback(async () => {
    setValidating('apikey');
    try {
      const valid = await validateOpenAIKey({
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel,
        baseUrl: settings.openaiBaseUrl,
      });
      setApiKeyValid(valid);
      showNotification(valid ? 'API Key 验证成功' : 'API Key 无效', valid ? 'success' : 'error');
    } catch {
      setApiKeyValid(false);
      showNotification('验证失败', 'error');
    } finally {
      setValidating(null);
    }
  }, [settings, showNotification]);

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Fade in timeout={400}>
        <Box sx={{ maxWidth: 700 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight={700}>
              应用设置
            </Typography>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              保存设置
            </Button>
          </Stack>

          {/* GitHub Token */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <GitHubIcon />
                <Typography variant="h6" fontWeight={600}>
                  GitHub 配置
                </Typography>
                {tokenValid === true && <Chip label="已连接" size="small" color="success" icon={<ValidIcon />} />}
                {tokenValid === false && <Chip label="无效" size="small" color="error" icon={<InvalidIcon />} />}
              </Stack>

              <TextField
                fullWidth
                label="Personal Access Token"
                type={showToken ? 'text' : 'password'}
                value={settings.githubToken}
                onChange={(e) => setSettings({ githubToken: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowToken(!showToken)} size="small">
                        {showToken ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="需要 repo, read:user 权限"
              />

              <Button
                variant="outlined"
                onClick={handleValidateToken}
                disabled={!settings.githubToken || validating === 'token'}
                size="small"
              >
                {validating === 'token' ? <CircularProgress size={18} /> : '验证 Token'}
              </Button>
            </CardContent>
          </Card>

          {/* OpenAI */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <AIIcon />
                <Typography variant="h6" fontWeight={600}>
                  LLM 配置 (OpenAI)
                </Typography>
                {apiKeyValid === true && <Chip label="已连接" size="small" color="success" icon={<ValidIcon />} />}
                {apiKeyValid === false && <Chip label="无效" size="small" color="error" icon={<InvalidIcon />} />}
              </Stack>

              <TextField
                fullWidth
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ openaiApiKey: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowApiKey(!showApiKey)} size="small">
                        {showApiKey ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Base URL"
                value={settings.openaiBaseUrl}
                onChange={(e) => setSettings({ openaiBaseUrl: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                helperText="默认 https://api.openai.com/v1，可替换为兼容 API"
              />

              <Autocomplete
                freeSolo
                options={['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']}
                value={settings.openaiModel}
                onInputChange={(_, v) => setSettings({ openaiModel: v })}
                size="small"
                sx={{ minWidth: 280, mb: 2 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="模型"
                    helperText="可选预设或手动输入自定义模型名称"
                  />
                )}
              />

              <Box>
                <Button
                  variant="outlined"
                  onClick={handleValidateApiKey}
                  disabled={!settings.openaiApiKey || validating === 'apikey'}
                  size="small"
                >
                  {validating === 'apikey' ? <CircularProgress size={18} /> : '验证 API Key'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Git */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <GitIcon />
                <Typography variant="h6" fontWeight={600}>
                  Git 配置
                </Typography>
                {gitAvailable === true && (
                  <Chip label="已安装" size="small" color="success" icon={<ValidIcon />} />
                )}
                {gitAvailable === false && (
                  <Chip label="未检测到" size="small" color="error" icon={<InvalidIcon />} />
                )}
              </Stack>

              {gitAvailable && gitVersion && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  版本: {gitVersion}
                </Typography>
              )}

              {gitAvailable === false && (
                <Alert severity="warning">
                  系统未检测到 git。请安装 git 以使用 Fork/Clone/PR 功能。
                </Alert>
              )}

              <TextField
                fullWidth
                label="工作目录"
                value={settings.workDirectory}
                onChange={(e) => setSettings({ workDirectory: e.target.value })}
                size="small"
                sx={{ mt: 2 }}
                placeholder="例如: C:\Projects\OpenSource"
                helperText="Fork 的仓库将克隆到此目录"
              />
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                数据管理
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                所有数据均存储在本地 SQLite 数据库中，不会上传至任何服务器。
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ClearIcon />}
                size="small"
                onClick={() => showNotification('清除缓存功能即将推出', 'info')}
              >
                清除搜索缓存
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
}
