package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// PublicVendor is the public-facing vendor representation (no sensitive data).
type PublicVendor struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	ModelCount  int64  `json:"model_count"`
}

// PublicModel is the public-facing model representation.
type PublicModel struct {
	Id          int    `json:"id"`
	ModelName   string `json:"model_name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Tags        string `json:"tags,omitempty"`
	VendorID    int    `json:"vendor_id,omitempty"`
	VendorName  string `json:"vendor_name,omitempty"`
	VendorIcon  string `json:"vendor_icon,omitempty"`
	CreatedTime int64  `json:"created_time"`
}

// GetPublicVendors returns all active vendors with their model counts.
// GET /api/public/vendors
func GetPublicVendors(c *gin.Context) {
	vendors, err := model.GetAllVendors(0, 1000)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	counts, _ := model.GetVendorModelCounts()

	result := make([]PublicVendor, 0, len(vendors))
	for _, v := range vendors {
		if v.Status != 1 {
			continue
		}
		result = append(result, PublicVendor{
			Id:          v.Id,
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
			ModelCount:  counts[int64(v.Id)],
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// GetPublicVendorByName returns a single vendor (by name) plus its model list.
// GET /api/public/vendors/:name
func GetPublicVendorByName(c *gin.Context) {
	name := c.Param("name")

	vendors, _, err := model.SearchVendors(name, 0, 100)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Exact match
	var vendor *model.Vendor
	for _, v := range vendors {
		if v.Name == name {
			vendor = v
			break
		}
	}
	if vendor == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "vendor not found"})
		return
	}

	models, total, err := model.SearchModels("", strconv.Itoa(vendor.Id), 0, 500)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	result := make([]PublicModel, 0, len(models))
	for _, m := range models {
		if m.Status != 1 {
			continue
		}
		result = append(result, PublicModel{
			Id:          m.Id,
			ModelName:   m.ModelName,
			Description: m.Description,
			Icon:        m.Icon,
			Tags:        m.Tags,
			VendorID:    m.VendorID,
			VendorName:  vendor.Name,
			VendorIcon:  vendor.Icon,
			CreatedTime: m.CreatedTime,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"vendor": PublicVendor{
			Id:          vendor.Id,
			Name:        vendor.Name,
			Description: vendor.Description,
			Icon:        vendor.Icon,
			ModelCount:  total,
		},
		"models": result,
	})
}

// GetPublicModels returns a paginated, filterable list of public models with vendor info.
// GET /api/public/models?q=gpt&vendor=openai&page=1&size=20
func GetPublicModels(c *gin.Context) {
	keyword := c.Query("q")
	vendor := c.Query("vendor")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	models, total, err := model.SearchModels(keyword, vendor, offset, size)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Build vendor lookup map
	allVendors, _ := model.GetAllVendors(0, 1000)
	vendorMap := make(map[int]*model.Vendor, len(allVendors))
	for _, v := range allVendors {
		vendorMap[v.Id] = v
	}

	result := make([]PublicModel, 0, len(models))
	for _, m := range models {
		if m.Status != 1 {
			continue
		}
		pm := PublicModel{
			Id:          m.Id,
			ModelName:   m.ModelName,
			Description: m.Description,
			Icon:        m.Icon,
			Tags:        m.Tags,
			VendorID:    m.VendorID,
			CreatedTime: m.CreatedTime,
		}
		if v, ok := vendorMap[m.VendorID]; ok {
			pm.VendorName = v.Name
			pm.VendorIcon = v.Icon
		}
		result = append(result, pm)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"total":   total,
		"page":    page,
		"size":    size,
	})
}
