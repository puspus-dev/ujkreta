package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/textproto"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

// Digitális dokumentumok – FTP backend
// Secrets / env (SOHA ne hardcode-old a jelszót):
//   FTP_HOST  pl. ftp.drivehq.com
//   FTP_USER
//   FTP_PASS  ← GitHub Secret / Render env
//   FTP_DIR   opcionális, pl. /digidoku

type digiDocMeta struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime,omitempty"`
	Type    string `json:"type"`
}

type ftpClient struct {
	conn *textproto.Conn
	raw  net.Conn
}

func ftpConfig() (host, user, pass, dir string, ok bool) {
	host = strings.TrimSpace(os.Getenv("FTP_HOST"))
	user = strings.TrimSpace(os.Getenv("FTP_USER"))
	pass = os.Getenv("FTP_PASS")
	dir = strings.TrimSpace(os.Getenv("FTP_DIR"))
	if dir == "" {
		dir = "/"
	}
	ok = host != "" && user != "" && pass != ""
	return
}

func (s *Server) registerDigiDocRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/digidocs", s.requireAuthSession(s.handleDigiDocsRoot))
	mux.HandleFunc("/api/digidocs/", s.requireAuthSession(s.handleDigiDocsByName))
}

func (s *Server) handleDigiDocsRoot(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleDigiDocList(w, r)
	case http.MethodPost:
		s.handleDigiDocUpload(w, r)
	default:
		methodNotAllowed(w, "GET, POST")
	}
}

func (s *Server) handleDigiDocsByName(w http.ResponseWriter, r *http.Request) {
	name := path.Base(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/digidocs/"), "/"))
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\\") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_name"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleDigiDocDownload(w, r, name)
	case http.MethodDelete:
		s.handleDigiDocDelete(w, r, name)
	default:
		methodNotAllowed(w, "GET, DELETE")
	}
}

func ftpDial() (*ftpClient, error) {
	host, user, pass, dir, ok := ftpConfig()
	if !ok {
		return nil, fmt.Errorf("FTP nincs konfigurálva (állítsd be: FTP_HOST, FTP_USER, FTP_PASS)")
	}
	addr := host
	if !strings.Contains(addr, ":") {
		addr += ":21"
	}
	raw, err := net.DialTimeout("tcp", addr, 20*time.Second)
	if err != nil {
		return nil, fmt.Errorf("FTP connect: %w", err)
	}
	_ = raw.SetDeadline(time.Now().Add(60 * time.Second))
	c := &ftpClient{conn: textproto.NewConn(raw), raw: raw}
	if _, _, err := c.conn.ReadResponse(220); err != nil {
		c.close()
		return nil, fmt.Errorf("FTP welcome: %w", err)
	}
	if err := c.cmd(331, "USER %s", user); err != nil {
		c.close()
		return nil, fmt.Errorf("FTP USER: %w", err)
	}
	if err := c.cmd(230, "PASS %s", pass); err != nil {
		c.close()
		return nil, fmt.Errorf("FTP PASS: %w", err)
	}
	_ = c.cmd(200, "TYPE I")
	if dir != "/" && dir != "" {
		d := strings.TrimPrefix(dir, "/")
		_ = c.cmd(257, "MKD %s", d) // ignore exists
		if err := c.cmd(250, "CWD %s", dir); err != nil {
			_ = c.cmd(250, "CWD %s", d)
		}
	}
	return c, nil
}

func (c *ftpClient) close() {
	if c.conn != nil {
		_ = c.cmd(221, "QUIT")
		_ = c.conn.Close()
	}
}

func (c *ftpClient) cmd(expect int, format string, args ...any) error {
	id, err := c.conn.Cmd(format, args...)
	if err != nil {
		return err
	}
	c.conn.StartResponse(id)
	defer c.conn.EndResponse(id)
	_, _, err = c.conn.ReadResponse(expect)
	return err
}

func (c *ftpClient) pasvConn() (net.Conn, error) {
	id, err := c.conn.Cmd("PASV")
	if err != nil {
		return nil, err
	}
	c.conn.StartResponse(id)
	code, msg, err := c.conn.ReadResponse(227)
	c.conn.EndResponse(id)
	if err != nil || code != 227 {
		return nil, fmt.Errorf("PASV: %v %s", err, msg)
	}
	start := strings.Index(msg, "(")
	end := strings.Index(msg, ")")
	if start < 0 || end < 0 {
		return nil, fmt.Errorf("PASV parse: %s", msg)
	}
	parts := strings.Split(msg[start+1:end], ",")
	if len(parts) < 6 {
		return nil, fmt.Errorf("PASV parts: %s", msg)
	}
	p1, _ := strconv.Atoi(strings.TrimSpace(parts[4]))
	p2, _ := strconv.Atoi(strings.TrimSpace(parts[5]))
	ip := strings.Join([]string{
		strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]),
		strings.TrimSpace(parts[2]), strings.TrimSpace(parts[3]),
	}, ".")
	dataAddr := fmt.Sprintf("%s:%d", ip, p1*256+p2)
	return net.DialTimeout("tcp", dataAddr, 20*time.Second)
}

func (c *ftpClient) withData(cmd string, args []any, openCodes []int, fn func(net.Conn) error) error {
	dc, err := c.pasvConn()
	if err != nil {
		return err
	}
	id, err := c.conn.Cmd(cmd, args...)
	if err != nil {
		dc.Close()
		return err
	}
	c.conn.StartResponse(id)
	code, msg, err := c.conn.ReadResponse(0)
	if err != nil {
		c.conn.EndResponse(id)
		dc.Close()
		return err
	}
	okOpen := false
	for _, cde := range openCodes {
		if code == cde {
			okOpen = true
			break
		}
	}
	if !okOpen {
		c.conn.EndResponse(id)
		dc.Close()
		return fmt.Errorf("data open %d: %s", code, msg)
	}
	fnErr := fn(dc)
	_ = dc.Close()
	_, _, err226 := c.conn.ReadResponse(226)
	c.conn.EndResponse(id)
	if fnErr != nil {
		return fnErr
	}
	return err226
}

func (c *ftpClient) list() ([]digiDocMeta, error) {
	var body []byte
	err := c.withData("LIST", nil, []int{125, 150}, func(dc net.Conn) error {
		var e error
		body, e = io.ReadAll(io.LimitReader(dc, 2<<20))
		return e
	})
	if err != nil {
		return nil, err
	}
	out := []digiDocMeta{}
	sc := bufio.NewScanner(bytes.NewReader(body))
	for sc.Scan() {
		line := sc.Text()
		fields := strings.Fields(line)
		if len(fields) < 9 {
			if len(fields) >= 4 {
				name := fields[len(fields)-1]
				if name == "." || name == ".." {
					continue
				}
				var size int64
				for _, f := range fields {
					if n, e := strconv.ParseInt(f, 10, 64); e == nil {
						size = n
					}
				}
				t := "file"
				if strings.Contains(strings.ToLower(line), "<dir>") {
					t = "folder"
					size = 0
				}
				out = append(out, digiDocMeta{Name: name, Size: size, Type: t})
			}
			continue
		}
		name := strings.Join(fields[8:], " ")
		if name == "." || name == ".." {
			continue
		}
		size, _ := strconv.ParseInt(fields[4], 10, 64)
		t := "file"
		if strings.HasPrefix(fields[0], "d") {
			t = "folder"
		}
		out = append(out, digiDocMeta{Name: name, Size: size, Type: t})
	}
	return out, nil
}

func (c *ftpClient) stor(name string, r io.Reader) error {
	return c.withData("STOR %s", []any{name}, []int{125, 150}, func(dc net.Conn) error {
		_, err := io.Copy(dc, r)
		return err
	})
}

func (c *ftpClient) retr(name string) ([]byte, error) {
	var data []byte
	err := c.withData("RETR %s", []any{name}, []int{125, 150}, func(dc net.Conn) error {
		var e error
		data, e = io.ReadAll(io.LimitReader(dc, 15<<20))
		return e
	})
	return data, err
}

func (c *ftpClient) dele(name string) error {
	return c.cmd(250, "DELE %s", name)
}

func (s *Server) handleDigiDocList(w http.ResponseWriter, r *http.Request) {
	if _, _, _, ok := sessionUser(r); !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	c, err := ftpDial()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer c.close()
	list, err := c.list()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "list_failed: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleDigiDocUpload(w http.ResponseWriter, r *http.Request) {
	username, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "multipart: " + err.Error()})
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file_required"})
		return
	}
	defer file.Close()
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = path.Base(hdr.Filename)
	}
	name = path.Base(name)
	if name == "" || name == "." || strings.Contains(name, "..") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_name"})
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, 10<<20))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "read_failed"})
		return
	}
	c, err := ftpDial()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer c.close()
	if err := c.stor(name, bytes.NewReader(data)); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload_failed: " + err.Error()})
		return
	}
	log.Printf("digidoc upload by %s: %s (%d B)", username, name, len(data))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name, "size": len(data), "uploadedBy": username})
}

func (s *Server) handleDigiDocDownload(w http.ResponseWriter, r *http.Request, name string) {
	if _, _, _, ok := sessionUser(r); !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	c, err := ftpDial()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer c.close()
	data, err := c.retr(name)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found: " + err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (s *Server) handleDigiDocDelete(w http.ResponseWriter, r *http.Request, name string) {
	_, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	c, err := ftpDial()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	defer c.close()
	if err := c.dele(name); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "delete_failed: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

var _ = json.Marshal
